import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'tavern.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        display_name TEXT,
        password_hash TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'user',
        is_dm INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT,
        img_url TEXT,
        creator_id TEXT,
        calendar_enabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        server_id TEXT,
        name TEXT,
        type TEXT,
        participant_ids TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT,
        user_id TEXT,
        content TEXT,
        type TEXT DEFAULT 'text',
        file_name TEXT,
        file_size TEXT,
        is_deleted INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(channel_id) REFERENCES channels(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS server_members (
        server_id TEXT,
        user_id TEXT,
        PRIMARY KEY (server_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS gifs (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE,
        added_by TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// Migration for file_name
try {
    const check = db.prepare('SELECT file_name FROM messages LIMIT 1').get();
} catch (e) {
    console.log("Migrating database: Adding file_name/size to messages...");
    db.prepare('ALTER TABLE messages ADD COLUMN file_name TEXT').run();
    db.prepare('ALTER TABLE messages ADD COLUMN file_size TEXT').run();
}

try {
    const check = db.prepare('SELECT display_name FROM users LIMIT 1').get();
} catch (e) {
    db.prepare('ALTER TABLE users ADD COLUMN display_name TEXT').run();
    db.prepare('UPDATE users SET display_name = username').run();
}

const encKeyRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('global_enc_key');
if (!encKeyRow) {
    const newKey = crypto.randomBytes(64).toString('hex');
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('global_enc_key', newKey);
}

const userCount = db.prepare('SELECT count(*) as count FROM users').get();
if (userCount.count === 0) {
    console.log('Seeding database...');
    const adminId = 'admin-id';
    const serverId = 'srv-1';
    
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (id, username, display_name, password_hash, role, is_dm, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(adminId, 'admin', 'Game Master', hash, 'admin', 1, 'https://ui-avatars.com/api/?name=GM&background=f59e0b&color=fff');

    db.prepare('INSERT INTO servers (id, name, img_url, creator_id) VALUES (?, ?, ?, ?)')
      .run(serverId, 'Adventurers Guild', '', adminId);

    const insertChannel = db.prepare('INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)');
    insertChannel.run('c-1', serverId, 'general-chat', 'text');
    insertChannel.run('c-2', serverId, 'scroll-library', 'scroll'); // Default Scroll Shop
    insertChannel.run('c-3', serverId, 'main-table', 'voice');

    db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(serverId, adminId);
}

export default db;