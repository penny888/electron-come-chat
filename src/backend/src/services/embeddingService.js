
const { CharacterTextSplitter } = require('@langchain/textsplitters');

const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../../.env') // 关键！写绝对路径
});

// 简单的嵌入模型（使用DeepSeek的embedding接口，需确认DeepSeek是否提供，若无则使用OpenAI）
// 注意：DeepSeek目前可能未开放embedding API，这里用OpenAI的embedding作为替代，或使用本地模型。
// 为简化，假设你有OpenAI key：
const { OpenAIEmbeddings } = require('@langchain/openai');
const embeddings = new OpenAIEmbeddings({
    baseURL: process.env.OPENAI_BASE_URL, 
    apiKey: process.env.OPENAI_API_KEY, // 若没有，可换用其他，如transformers.js本地模型，但Milvus需要1536维
    modelName: 'text-embedding-v4', // 选择一个适合的embedding模型
    dimensions: 1536, // 确保与Milvus collection一致
});


async function getEmbedding(text) {
    const res = await embeddings.embedQuery(text?.trim());
    return res;
}

// 分块文本并批量向量化
async function chunkAndEmbed(text, chunkSize = 1000) {
    const splitter = new CharacterTextSplitter({
        separator: "\n\n",
        chunkSize: chunkSize,
        chunkOverlap: 200,
    });
    const chunks = await splitter.splitText(text);

    console.log(`文本分为 ${chunks.length} 块`);

    const embeddings = [];
    for (const chunk of chunks) {
        const emb = await getEmbedding(chunk);
        embeddings.push({ content: chunk, embedding: emb });
    }
    return embeddings;
}


module.exports = { getEmbedding, chunkAndEmbed };