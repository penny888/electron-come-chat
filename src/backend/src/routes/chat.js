// Chat routes
const express = require('express');
const router = express.Router();
const { streamChatWithRAG } = require('../services/langchainService');
const db = require('../utils/sqliteDb');
const { v4: uuidv4 } = require('uuid');

// 中间件：验证JWT (简化，先省略完整实现)
const authMiddleware = (req, res, next) => {
    // 从header取token，验证并设置req.userId
    req.userId = 'test-user-id'; // 测试用
    next();
};

// 流式聊天接口
router.post('/stream', authMiddleware, async (req, res) => {
    const { conversationId, message, useRag = false } = req.body;
    const userId = req.userId;

    if (!message) return res.status(400).json({ error: 'Message required' });

    // 获取或创建对话记录
    let convId = conversationId;
    if (!convId) {
        convId = uuidv4();
        db.prepare(`INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)`).run(convId, userId, message.slice(0, 50));
    }

    // 保存用户消息
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), convId, 'user', message);

    // 获取历史消息（最近10条）

    let historyRows = await queryAll(`
    SELECT role, content FROM messages 
    WHERE conversation_id = ? 
    ORDER BY created_at DESC LIMIT 10
    `, [convId]);
    historyRows = historyRows.reverse();

    const history = historyRows.map(row => ({ role: row.role, content: row.content }));

    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullAssistantReply = '';

    try {
        // 调用流式生成
        const stream = streamChatWithRAG(history, useRag);
        for await (const chunk of stream) {
            fullAssistantReply += chunk;
            // 发送SSE数据
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
        // 完成标志
        res.write(`data: ${JSON.stringify({ done: true, fullReply: fullAssistantReply })}\n\n`);
        res.end();

        // 保存助手回复到数据库
        db.prepare(`INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)`)
            .run(uuidv4(), convId, 'assistant', fullAssistantReply);
    } catch (err) {
        console.error(err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// 获取历史对话
router.get('/history/:conversationId', authMiddleware, async (req, res) => {
    const { conversationId } = req.params;

    const messages = await queryAll(`
    SELECT id, role, content, created_at FROM messages 
    WHERE conversation_id = ? ORDER BY created_at ASC
    `, [conversationId]);

    res.json({ messages });

});

// 获取当前用户的所有会话
router.get('/conversations', authMiddleware, async (req, res) => {
    const userId = req.userId;

    const rows = await queryAll(`
    SELECT id, title, created_at FROM conversations 
    WHERE user_id = ? ORDER BY created_at DESC
    `, [userId]);

    res.json(rows);
});

function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql);
        stmt.all(params, (err, rows) => {
            stmt.finalize();
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = router;