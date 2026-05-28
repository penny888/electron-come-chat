// src/routes/admin.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

const { listKnowledge, countKnowledge, deleteKnowledge, insertKnowledge } = require('../utils/milvusClient');
const { chunkAndEmbed } = require('../services/embeddingService');

const upload = multer({ dest: 'uploads/' });

// 中间件：简单鉴权（可加密码，演示略）
function adminAuth(req, res, next) {
    // 可增加 session 或 basic auth
    next();
}

// 知识库首页（列表）
router.get('/', adminAuth, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const items = await listKnowledge(limit, offset);
    const total = await countKnowledge();
    res.render('admin/index', { items, currentPage: page, totalPages: Math.ceil(total / limit) });
});

// 上传页面
router.get('/upload', adminAuth, (req, res) => {
    res.render('admin/upload', { error: null, success: null });
});

// 处理上传
router.post('/upload', adminAuth, upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) return res.render('admin/upload', { error: '请选择文件', success: null });

    try {
        let text = '';
        if (file.mimetype === 'text/plain') {
            text = fs.readFileSync(file.path, 'utf8');
        } else if (file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: file.path });
            text = result.value;
        } else {
            throw new Error('不支持的文件类型，请上传 .txt, .pdf, .docx');
        }

        // 分块并生成向量
        const chunks = await chunkAndEmbed(text);
    
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
        console.log("file.originalname >>>>", file.originalname);
        // 存入 Milvus
        let allInsertPromises = [];
        for (const chunk of chunks) {
            allInsertPromises.push(insertKnowledge(chunk.content, chunk.embedding, { source: file.originalname }));
        }

        Promise.all(allInsertPromises).then(() => {
            console.log('All chunks inserted successfully >>>>');
            res.render('admin/upload', { error: null, success: `成功上传并处理 ${chunks.length} 个知识片段` });
        }).catch(err => {
            console.error('Error inserting chunks >>>>', err);
            res.render('admin/upload', { error: '上传并向量化失败', success: null });
        });

        // 删除临时文件
        fs.unlinkSync(file.path);
    
    } catch (err) {
        console.error(err);
        fs.unlinkSync(file.path);
        res.render('admin/upload', { error: err.message, success: null });
    }
});

// 删除知识条目
router.post('/delete', adminAuth, async (req, res) => {
    let ids = req.body.ids;
    if (ids && ids.length) {
        if (!Array.isArray(ids)) ids = [ids];  // 确保为数组
        await deleteKnowledge(ids);
    }
    res.redirect('/admin');
});

module.exports = router;