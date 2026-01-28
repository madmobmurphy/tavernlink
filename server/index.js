diff --git a/server/index.js b/server/index.js
index cb686e0e0c435e544e5e1abd3faaae83930ceaf5..8fdf42661222dee8aeab2bf0d8093e75020e5fb2 100644
--- a/server/index.js
+++ b/server/index.js
@@ -3,51 +3,51 @@ import { createServer } from 'http';
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
 
-const PORT = 3003;
+const PORT = Number(process.env.PORT) || 3003;
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
@@ -463,26 +463,26 @@ app.post('/api/ai/generate', authenticate, async (req, res) => {
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
 
-httpServer.listen(PORT, () => console.log(`TavernLink Server running on port ${PORT}`));
\ No newline at end of file
+httpServer.listen(PORT, () => console.log(`TavernLink Server running on port ${PORT}`));
