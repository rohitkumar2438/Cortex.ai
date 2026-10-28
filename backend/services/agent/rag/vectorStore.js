/**
 * Vector Store Engine for Cortex AI RAG.
 * Implements Pinecone vector indexing with automatic in-memory fallback.
 * Supports metadata filtering by userId, conversationId, and docName.
 */
import { Pinecone } from '@pinecone-database/pinecone';

// In-Memory Vector Store for dev, tests, or when PINECONE_API_KEY is not set
class InMemoryVectorStore {
    constructor() {
        this.records = []; // Array of { id, values, metadata }
    }

    async upsert(records) {
        for (const record of records) {
            const existingIdx = this.records.findIndex(r => r.id === record.id);
            if (existingIdx >= 0) {
                this.records[existingIdx] = record;
            } else {
                this.records.push(record);
            }
        }
        return { upsertedCount: records.length };
    }

    cosineSimilarity(vecA, vecB) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        const len = Math.min(vecA.length, vecB.length);

        for (let i = 0; i < len; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    async query({ vector, topK = 4, filter = {} }) {
        let candidates = this.records;

        // Apply metadata filters
        if (filter.userId) {
            candidates = candidates.filter(r => r.metadata?.userId === filter.userId);
        }
        if (filter.conversationId) {
            candidates = candidates.filter(r =>
                r.metadata?.conversationId === filter.conversationId ||
                !r.metadata?.conversationId ||
                r.metadata?.conversationId === 'default'
            );
        }
        if (filter.docName) {
            candidates = candidates.filter(r => r.metadata?.docName === filter.docName);
        }

        // Calculate cosine similarity
        const scored = candidates.map(r => ({
            id: r.id,
            score: this.cosineSimilarity(vector, r.values),
            metadata: r.metadata
        }));

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    async deleteMany(filter = {}) {
        const initialCount = this.records.length;
        this.records = this.records.filter(r => {
            if (filter.docName && r.metadata?.docName === filter.docName) return false;
            if (filter.conversationId && r.metadata?.conversationId === filter.conversationId) return false;
            return true;
        });
        return { deleted: initialCount - this.records.length };
    }

    listDocs(filter = {}) {
        const docsMap = new Map();
        for (const r of this.records) {
            const meta = r.metadata || {};
            if (filter.userId && meta.userId !== filter.userId) continue;
            if (filter.conversationId && meta.conversationId !== filter.conversationId) continue;

            const docName = meta.docName;
            if (!docName) continue;

            if (!docsMap.has(docName)) {
                docsMap.set(docName, {
                    docName,
                    userId: meta.userId,
                    conversationId: meta.conversationId,
                    totalChunks: 0,
                    uploadedAt: meta.uploadedAt || new Date().toISOString()
                });
            }
            docsMap.get(docName).totalChunks++;
        }
        return Array.from(docsMap.values());
    }
}

// Global in-memory singleton
const inMemoryStore = new InMemoryVectorStore();

let pineconeClient = null;
let pineconeIndex = null;

const getPineconeIndex = () => {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX || 'cortex-ai';

    if (apiKey && !apiKey.includes('dummy') && !apiKey.includes('your_')) {
        if (!pineconeIndex) {
            try {
                pineconeClient = new Pinecone({ apiKey });
                pineconeIndex = pineconeClient.index(indexName);
                console.log(`🌲 Pinecone Client initialized for index: ${indexName}`);
            } catch (err) {
                console.warn('⚠️ Could not initialize Pinecone client, using in-memory store:', err.message);
                return null;
            }
        }
        return pineconeIndex;
    }
    return null;
};

/**
 * Upserts vectorized chunks into vector store.
 */
export const upsertVectors = async (records) => {
    const pinecone = getPineconeIndex();
    if (pinecone) {
        try {
            await pinecone.upsert(records);
            // Also mirror in-memory for local document listing
            await inMemoryStore.upsert(records);
            return { success: true, count: records.length, target: 'pinecone' };
        } catch (err) {
            console.warn('⚠️ Pinecone upsert failed, mirroring to in-memory:', err.message);
        }
    }
    await inMemoryStore.upsert(records);
    return { success: true, count: records.length, target: 'in-memory' };
};

/**
 * Searches vector store for relevant chunks matching the query vector.
 */
export const queryVectors = async ({ vector, topK = 4, filter = {} }) => {
    const pinecone = getPineconeIndex();
    if (pinecone) {
        try {
            const pineconeFilter = {};
            if (filter.userId) pineconeFilter.userId = { $eq: filter.userId };
            if (filter.conversationId) pineconeFilter.conversationId = { $eq: filter.conversationId };

            const queryRes = await pinecone.query({
                vector,
                topK,
                includeMetadata: true,
                filter: Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined
            });

            if (queryRes.matches && queryRes.matches.length > 0) {
                return queryRes.matches.map(m => ({
                    id: m.id,
                    score: m.score,
                    metadata: m.metadata
                }));
            }
        } catch (err) {
            console.warn('⚠️ Pinecone query failed, falling back to in-memory query:', err.message);
        }
    }

    return await inMemoryStore.query({ vector, topK, filter });
};

/**
 * Deletes documents by name.
 */
export const deleteDocument = async (docName, filter = {}) => {
    return await inMemoryStore.deleteMany({ docName, ...filter });
};

/**
 * Lists uploaded documents for a given user or conversation.
 */
export const listDocuments = (filter = {}) => {
    return inMemoryStore.listDocs(filter);
};

export default {
    upsertVectors,
    queryVectors,
    deleteDocument,
    listDocuments
};

