// Milvus vector database client
const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');

const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../../.env') // 关键！写绝对路径
});

const milvusClient = new MilvusClient({
    address: process.env.MILVUS_ADDRESS,
});

const COLLECTION_NAME = 'knowledge_base';

async function initMilvus() {
    // 检查collection是否存在
    const hasCollection = await milvusClient.hasCollection({ collection_name: COLLECTION_NAME });
    if (!hasCollection.value) {
        // 创建collection：主键id，向量字段dim=1536（DeepSeek embedding维度）
        await milvusClient.createCollection({
            collection_name: COLLECTION_NAME,
            fields: [
                { name: 'id', data_type: DataType.Int64, is_primary_key: true, autoID: true },
                { name: 'content', data_type: DataType.VarChar, max_length: 65535 },
                { name: 'metadata', data_type: DataType.JSON },
                { name: 'embedding', data_type: DataType.FloatVector, dim: 1536 },
                { name: 'created_at', data_type: DataType.Int64 },
            ],
        });
        // 创建索引
        await milvusClient.createIndex({
            collection_name: COLLECTION_NAME,
            field_name: 'embedding',
            index_type: 'IVF_FLAT',
            metric_type: 'COSINE',
            params: { nlist: 128 },
        });

        await milvusClient.createIndex({
            collection_name: COLLECTION_NAME,
            field_name:"metadata",
            index_type: "AUTOINDEX", 
            index_name: "source_index",
            params: {
                json_path: 'metadata["source"]',
                json_cast_type: "VARCHAR"
            }
        })

        await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });

        console.log('Milvus collection created');
    }

}

// 插入知识向量
async function insertKnowledge(content, embedding, metadata = {}) {
    const insertObj = {
        collection_name: COLLECTION_NAME,
        data: [{ content, embedding, metadata, created_at: Date.now() }],
    };

    const result = await milvusClient.insert(insertObj)
        .then(() => {
            console.log('insertKnowledge success >>>>');
        })
        .catch(error => {
            console.error("insertKnowledge error >>>>", error);
        });
    return result;
}

// 分页查询所有知识
async function listKnowledge(limit = 20, offset = 0) {
    const res = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        expr: "id > 0",
        output_fields: ["id", "content", "metadata", "created_at"],
        limit,
        offset,
    });
    return res.data;
}

// 统计总数
async function countKnowledge() {
    const res = await milvusClient.count({
        collection_name: COLLECTION_NAME,
        filter: 'id > 0',
    });
    return res.data;
}

// 删除知识（按ID）
async function deleteKnowledge(ids) {
    await milvusClient.deleteEntities({
        collection_name: COLLECTION_NAME,
        expr: `id in [${ids.join(',')}]`,
    });
}

// 相似性检索
async function searchSimilar(embedding, topK = 3) {
    const res = await milvusClient.search({
        collection_name: COLLECTION_NAME,
        vectors: [embedding],
        search_params: { anns_field: 'embedding', topk: topK, metric_type: 'COSINE', params: JSON.stringify({ nprobe: 10 }) },
        output_fields: ['content'],
    });
    return res.results.map(r => r.content);
}

initMilvus().catch(console.error);


module.exports = { milvusClient, insertKnowledge, searchSimilar, listKnowledge, countKnowledge, deleteKnowledge };