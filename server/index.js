import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './database.js';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8 // 100MB socket limit
});

const PORT = 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'tavernlink-secret-key-change-me';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

// --- Configurable Multer ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        // Restricted types: Images, PDF, Office, TXT
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf', 'text/plain',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // doc, docx
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // xls, xlsx
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images, PDFs, Office docs, and TXT allowed.'));
        }
    }
});

// --- Auth Middleware ---
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Forbidden" });
        req.user = user;
        next();
    });
};

// --- Routes ---

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    let needsPasswordChange = false;
    if (username === 'admin' && bcrypt.compareSync('admin', user.password_hash)) {
        needsPasswordChange = true;
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '60d' });
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            name: user.display_name || user.username, 
            username: user.username, 
            avatar: user.avatar, 
            role: user.role, 
            isDM: user.is_dm === 1,
            needsPasswordChange
        } 
    });
});

// Register
app.post('/api/register', (req, res) => {
    const { username, password, isHuman } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    if (!isHuman) return res.status(400).json({ error: "Bots not allowed" });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: "Username taken" });

    const id = `u-${Date.now()}`;
    const hash = bcrypt.hashSync(password, 10);
    const avatar = `https://ui-avatars.com/api/?name=${username}&background=random`;
    const recoveryKey = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    try {
        db.prepare('INSERT INTO users (id, username, display_name, password_hash, avatar) VALUES (?, ?, ?, ?, ?)')
          .run(id, username, username, hash, avatar);
        
        const defaultServer = db.prepare('SELECT id FROM servers LIMIT 1').get();
        if (defaultServer) {
            db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(defaultServer.id, id);
        }

        const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '60d' });
        res.json({ token, user: { id, name: username, username, avatar, role: 'user', isDM: false }, recoveryKey });
    } catch (e) {
        res.status(500).json({ error: "Database error" });
    }
});

// Update User
app.put('/api/users/:id', authenticate, (req, res) => {
    const userId = req.params.id;
    if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden" });
    }

    const { name, avatar, role, isDM, password } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name) { updates.push('display_name = ?'); params.push(name); }
        if (avatar) { updates.push('avatar = ?'); params.push(avatar); }
        if (password) {
            const hash = bcrypt.hashSync(password, 10);
            updates.push('password_hash = ?');
            params.push(hash);
        }
        if (req.user.role === 'admin' || req.user.role === 'power_user') {
             if (role) { updates.push('role = ?'); params.push(role); }
             if (isDM !== undefined) { updates.push('is_dm = ?'); params.push(isDM ? 1 : 0); }
        }

        if (updates.length > 0) {
            params.push(userId);
            db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
        
        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const userData = {
            id: updated.id,
            name: updated.display_name || updated.username,
            username: updated.username,
            avatar: updated.avatar,
            role: updated.role,
            isDM: updated.is_dm === 1
        };
        io.emit('user_update', userData);
        res.json(userData);
    } catch (e) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete('/api/users/:id', authenticate, (req, res) => {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        db.prepare('DELETE FROM server_members WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM messages WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        io.emit('user_deleted', { id: req.params.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// Init Data
app.get('/api/init', authenticate, (req, res) => {
    const userId = req.user.id;
    const userRaw = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!userRaw) return res.status(404).json({error: "User not found"});

    const user = { 
        id: userRaw.id, 
        name: userRaw.display_name || userRaw.username, 
        username: userRaw.username, 
        avatar: userRaw.avatar, 
        role: userRaw.role, 
        isDM: userRaw.is_dm === 1 
    };

    let serversRaw;
    if (user.role === 'admin') {
        serversRaw = db.prepare('SELECT * FROM servers').all();
    } else {
        serversRaw = db.prepare(`SELECT s.* FROM servers s JOIN server_members sm ON s.id = sm.server_id WHERE sm.user_id = ?`).all(userId);
    }

    const servers = serversRaw.map(s => {
        const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(s.id);
        return { ...s, memberIds: members.map(m => m.user_id), sessions: [] };
    });

    const channels = [];
    if (servers.length > 0) {
        const serverIds = servers.map(s => s.id);
        const chans = db.prepare(`SELECT * FROM channels WHERE server_id IN (${serverIds.map(() => '?').join(',')}) OR type = 'dm'`).all(...serverIds);
        const visibleChannels = chans.filter(c => {
            if (c.type !== 'dm') return true;
            return c.participant_ids ? c.participant_ids.includes(userId) : false;
        });
        channels.push(...visibleChannels.map(c => ({ ...c, participantIds: c.participant_ids ? JSON.parse(c.participant_ids) : [] })));
    }

    const allUsers = db.prepare(`SELECT id, username, display_name, avatar, role, is_dm FROM users`).all().map(u => ({
        id: u.id, 
        name: u.display_name || u.username, 
        username: u.username, 
        avatar: u.avatar, 
        role: u.role, 
        isDM: u.is_dm === 1 
    }));

    const gifs = db.prepare('SELECT id, url, added_by as addedBy FROM gifs').all();
    const encKeyRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('global_enc_key');
    
    // Get Upload Limit
    const uploadLimitRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('upload_limit_mb');
    const uploadLimitMB = uploadLimitRow ? parseInt(uploadLimitRow.value) : 10;

    res.json({ user, servers, channels, users: allUsers, gifs, globalKey: encKeyRow ? encKeyRow.value : '', uploadLimitMB });
});

// Server/Channel Management
app.post('/api/servers', authenticate, (req, res) => {
    const { name, imgUrl } = req.body;
    const id = `srv-${Date.now()}`;
    db.prepare('INSERT INTO servers (id, name, img_url, creator_id) VALUES (?, ?, ?, ?)').run(id, name, imgUrl || '', req.user.id);
    db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(id, req.user.id);
    const channelId = `c-${Date.now()}`;
    db.prepare('INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)').run(channelId, id, 'general', 'text');
    res.json({ id, name, imgUrl, creatorId: req.user.id, memberIds: [req.user.id], sessions: [], defaultChannel: { id: channelId, serverId: id, name: 'general', type: 'text' } });
});

app.post('/api/servers/:id/invite', authenticate, (req, res) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({error: "Server not found"});
    if (server.creator_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: "Only the Tavern Keeper can invite others." });
    db.prepare('INSERT OR IGNORE INTO server_members (server_id, user_id) VALUES (?, ?)').run(req.params.id, req.body.userId);
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.user.id === req.body.userId);
    if (targetSocket) targetSocket.emit('added_to_server', { serverId: req.params.id });
    const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(req.params.id);
    res.json({ success: true, memberIds: members.map(m => m.user_id) });
});

app.delete('/api/servers/:id/members/:userId', authenticate, (req, res) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({error: "Server not found"});
    if (server.creator_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: "Only the Tavern Keeper can banish others." });
    if (req.params.userId === server.creator_id) return res.status(400).json({ error: "Cannot banish the creator." });
    db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.user.id === req.params.userId);
    if (targetSocket) targetSocket.emit('removed_from_server', { serverId: req.params.id });
    const members = db.prepare('SELECT user_id FROM server_members WHERE server_id = ?').all(req.params.id);
    res.json({ success: true, memberIds: members.map(m => m.user_id) });
});

app.post('/api/channels', authenticate, (req, res) => {
    const { name, type, serverId, participantIds } = req.body;
    const id = `c-${Date.now()}`;
    const pIds = participantIds ? JSON.stringify(participantIds) : null;
    db.prepare('INSERT INTO channels (id, server_id, name, type, participant_ids) VALUES (?, ?, ?, ?, ?)').run(id, serverId, name, type, pIds);
    res.json({ id, serverId, name, type, participantIds: participantIds || [] });
});

app.delete('/api/channels/:id', authenticate, (req, res) => {
    db.prepare('DELETE FROM messages WHERE channel_id = ?').run(req.params.id);
    db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- Messages & Uploads ---

app.get('/api/messages/:channelId', authenticate, (req, res) => {
    const msgs = db.prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp ASC LIMIT 200').all(req.params.channelId);
    res.json(msgs.map(m => ({
        id: m.id,
        channelId: m.channel_id,
        userId: m.user_id,
        content: m.content,
        timestamp: m.timestamp,
        type: m.type,
        fileName: m.file_name,
        fileSize: m.file_size,
        isDeleted: m.is_deleted === 1
    })));
});

app.post('/api/messages', authenticate, (req, res) => {
    const { channelId, content, type } = req.body;
    const msg = {
        id: `m-${Date.now()}`,
        channelId,
        userId: req.user.id,
        content,
        type: type || 'text',
        isDeleted: false,
        timestamp: new Date().toISOString()
    };
    db.prepare('INSERT INTO messages (id, channel_id, user_id, content, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(msg.id, msg.channelId, msg.userId, msg.content, msg.type, msg.timestamp);
    io.to(channelId).emit('message', msg);
    res.json(msg);
});

// File Upload Endpoint
app.post('/api/upload', authenticate, (req, res) => {
    const limitRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('upload_limit_mb');
    const limitMB = limitRow ? parseInt(limitRow.value) : 10;
    
    // Multer wrapper to handle custom limit logic before processing
    const uploadHandler = upload.single('file');

    uploadHandler(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Check size manually against DB setting (Multer limits are static init)
        if (req.file.size > limitMB * 1024 * 1024) {
             fs.unlinkSync(req.file.path);
             return res.status(400).json({ error: `File exceeds limit of ${limitMB}MB` });
        }

        const { channelId } = req.body;
        const fileUrl = `/uploads/${req.file.filename}`;
        const msgId = `m-${Date.now()}`;
        
        // Determine type based on mime
        let type = 'file';
        if (req.file.mimetype.startsWith('image/')) type = 'image';

        const msg = {
            id: msgId,
            channelId,
            userId: req.user.id,
            content: fileUrl,
            type,
            fileName: req.file.originalname,
            fileSize: (req.file.size / 1024).toFixed(1) + ' KB',
            timestamp: new Date().toISOString()
        };

        db.prepare('INSERT INTO messages (id, channel_id, user_id, content, type, file_name, file_size, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(msg.id, msg.channelId, msg.userId, msg.content, msg.type, msg.fileName, msg.fileSize, msg.timestamp);

        io.to(channelId).emit('message', msg);
        res.json(msg);
    });
});

app.delete('/api/messages/:id', authenticate, (req, res) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (msg && (msg.user_id === req.user.id || req.user.role === 'admin' || req.user.role === 'power_user')) {
        // If file, delete from disk
        if (msg.type === 'file' || msg.type === 'image') {
             try {
                 const filePath = path.join(uploadDir, path.basename(msg.content));
                 if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
             } catch(e) { console.error("Error deleting file:", e); }
        }
        db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id); // Hard delete for files to clean up
        io.to(msg.channel_id).emit('message_deleted', { id: req.params.id });
        res.json({ success: true });
    } else {
        res.status(403).json({ error: "Forbidden" });
    }
});

// --- System Settings ---
app.post('/api/admin/settings', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { uploadLimitMB } = req.body;
    if (uploadLimitMB) {
        db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('upload_limit_mb', String(uploadLimitMB));
    }
    res.json({ success: true });
});

// --- AI ---
app.post('/api/ai/config', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
        db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('ai_config', JSON.stringify(req.body));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed to save settings" }); }
});

app.get('/api/ai/config', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('ai_config');
    res.json(row ? JSON.parse(row.value) : null);
});

app.post('/api/ai/generate', authenticate, async (req, res) => {
    const { prompt, type } = req.body; // type can be 'chat' now
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('ai_config');
    if (!row) return res.status(503).json({ error: "AI not configured." });
    
    const config = JSON.parse(row.value);
    
    // Default system instruction if chat
    const systemInstruction = config.systemInstruction || "You are a helpful and mysterious Dungeon Master.";
    const tokenLimit = config.tokenLimit || 200;

    if (config.provider === 'gemini') {
        const apiKey = config.apiKey || process.env.API_KEY;
        if (!apiKey) return res.status(503).json({ error: "No API Key." });
        try {
            const ai = new GoogleGenAI({ apiKey });
            // Logic for different tasks
            const finalPrompt = type === 'chat' ? prompt : (type === 'npc' ? config.prompts.npc : config.prompts.plot);

            const response = await ai.models.generateContent({ 
                model: config.modelName || "gemini-3-flash-preview", 
                contents: finalPrompt,
                config: {
                    maxOutputTokens: tokenLimit,
                    systemInstruction
                }
            });
            return res.json({ text: response.text });
        } catch (e) { return res.status(500).json({ error: e.message }); }
    } else {
        // OpenAI / Local
        try {
            const apiRes = await fetch(`${config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                body: JSON.stringify({ 
                    model: config.modelName || 'gpt-3.5-turbo', 
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: prompt || (type === 'npc' ? config.prompts.npc : config.prompts.plot) }
                    ],
                    max_tokens: tokenLimit
                })
            });
            const data = await apiRes.json();
            return res.json({ text: data.choices?.[0]?.message?.content || "No response." });
        } catch(e) { return res.status(500).json({ error: e.message }); }
    }
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../dist/index.html')); });
}

io.on('connection', (socket) => {
    const token = socket.handshake.auth.token;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        socket.on('join_channel', (id) => socket.join(id));
        socket.on('user_update', (data) => io.emit('user_update', { id: socket.user.id, ...data }));
        socket.on('disconnect', () => {});
    } catch (e) { socket.disconnect(); }
});

httpServer.listen(PORT, () => console.log(`TavernLink Server running on port ${PORT}`));