// SQLite database
const sqlite = require('sqlite3').verbose();
const Database = sqlite.Database;
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '../../.env') // 关键！写绝对路径
});

// 优先使用环境变量指定的路径
let dbPath = process.env.SQLITE_DB_PATH;

if (!dbPath) {
  // 开发环境：使用项目根目录下的 data/app.db
  const isDev = process.env.NODE_ENV === 'development' || !process.env.RESOURCES_PATH;

  if (isDev) {
    dbPath = path.join(__dirname, '../../../data/app.db');
  } else {
    // 生产环境：使用用户数据目录（需要由 Electron 主进程传入）
    // 这里默认给出一个 fallback，但最好由主进程设置环境变量
    dbPath = path.join(process.env.APPDATA || process.env.HOME, 'come-chat', 'app.db');
  }
}

// 确保目录存在
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    model TEXT DEFAULT 'deepseek-chat',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tokens INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
  );
`);

module.exports = db;