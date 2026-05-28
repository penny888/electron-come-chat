// src/backend/app.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 视图引擎配置（用于后台管理页面）
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 路由挂载
app.use('/api/chat', chatRoutes);
app.use('/admin', adminRouter);

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '内部服务器错误' });
});

// 启动服务器的函数（供 Electron 主进程调用）
function startServer() {
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            console.log(`后端服务已启动: http://localhost:${PORT}`);
            resolve(server);
        }).on('error', reject);
    });
}

// 如果直接运行此文件（如 node app.js），则启动服务器
if (require.main === module) {
    startServer().catch(err => {
        console.error('启动失败:', err);
        process.exit(1);
    });
}

module.exports = { app, startServer };