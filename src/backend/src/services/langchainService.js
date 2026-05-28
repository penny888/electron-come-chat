// LangChain service
const { ChatOpenAI } = require('@langchain/openai');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { searchSimilar } = require('../utils/milvusClient');
const { getEmbedding } = require('../services/embeddingService');

const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../../.env') // 关键！写绝对路径
});

// 初始化DeepSeek模型（兼容OpenAI）
const deepseekChat = new ChatOpenAI({
    openAIApiKey: process.env.DEEPSEEK_API_KEY,
    configuration: { baseURL: process.env.DEEPSEEK_BASE_URL },
    modelName: 'deepseek-chat',
    streaming: true,   // 启用流式
    temperature: 0.7,
});

// 检索增强的对话生成（流式）
async function* streamChatWithRAG(messages, useRag = false) {
    // 获取最后一条用户消息
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    let context = '';
    if (useRag && lastUserMsg) {
        const queryEmbedding = await getEmbedding(lastUserMsg);
        const docs = await searchSimilar(queryEmbedding, 3);
        context = docs.join('\n\n');
    }

    // 构建LangChain消息格式
    const lcMessages = [];
    if (context) {
        lcMessages.push(new SystemMessage(`以下是相关知识：\n${context}\n\n请基于知识回答用户问题。`));
    }
    for (const msg of messages) {
        if (msg.role === 'user') lcMessages.push(new HumanMessage(msg.content));
        else if (msg.role === 'assistant') lcMessages.push(new AIMessage(msg.content));
    }

    // 流式调用
    const stream = await deepseekChat.stream(lcMessages);
    for await (const chunk of stream) {
        yield chunk.content;
    }
}

// 非流式调用（历史保存用）
async function chatCompletion(messages, useRag = false) {
    let fullResponse = '';
    for await (const chunk of streamChatWithRAG(messages, useRag)) {
        fullResponse += chunk;
    }
    return fullResponse;
}

module.exports = { streamChatWithRAG, chatCompletion };