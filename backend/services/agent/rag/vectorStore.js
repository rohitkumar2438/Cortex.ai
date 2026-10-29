/**
 * Vector Store Engine for Cortex AI RAG.
 * Implements Pinecone vector indexing with automatic in-memory fallback.
 * Supports metadata filtering by userId, conversationId, and docName.
 */
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
}
const CACHE_FILE = fs.existsSync(uploadsDir)
    ? path.resolve(uploadsDir, 'vector_cache.json')
    : path.resolve(process.cwd(), 'vector_cache.json');

// In-Memory Vector Store for dev, tests, or when PINECONE_API_KEY is not set
class InMemoryVectorStore {
    constructor() {
        this.records = []; // Array of { id, values, metadata }
        this.loadCache();
    }

    loadCache() {
        try {
            // Check primary uploads cache location, then fallback to cwd
            const primaryPath = CACHE_FILE;
            const fallbackPath = path.resolve(process.cwd(), 'vector_cache.json');
            const targetPath = fs.existsSync(primaryPath) ? primaryPath : fs.existsSync(fallbackPath) ? fallbackPath : null;

            if (targetPath) {
                const data = fs.readFileSync(targetPath, 'utf-8');
                this.records = JSON.parse(data) || [];
                console.log(`📂 Loaded ${this.records.length} records from persistent vector cache at: ${targetPath}`);
            }
        } catch (err) {
            console.warn('⚠️ Could not load vector cache:', err.message);
        }
    }

    saveCache() {
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(this.records), 'utf-8');
        } catch (err) {
            console.warn('⚠️ Could not save vector cache:', err.message);
        }
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
        this.saveCache();
        return { upsertedCount: records.length };
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
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

    async query({ vector, prompt = '', topK = 4, filter = {} }) {
        let candidates = this.records;

        // Apply metadata filters if available
        let filtered = candidates;
        if (filter.userId) {
            filtered = filtered.filter(r => r.metadata?.userId === filter.userId);
        }
        if (filter.conversationId) {
            filtered = filtered.filter(r =>
                r.metadata?.conversationId === filter.conversationId ||
                !r.metadata?.conversationId ||
                r.metadata?.conversationId === 'default'
            );
        }
        if (filter.docName) {
            filtered = filtered.filter(r => r.metadata?.docName === filter.docName);
        }

        // If strict filtering returned no candidates, relax filter to all uploaded documents
        if (filtered.length > 0) {
            candidates = filtered;
        }

        // Hybrid Lexical Token Matching
        const stopWords = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'with', 'from', 'have', 'your', 'about', 'tell', 'show', 'give', 'please', 'the', 'is', 'are', 'was', 'were', 'my', 'me', 'i', 'can', 'you', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'how', 'do', 'does', 'it']);
        const promptTokens = (prompt || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length >= 2 && !stopWords.has(t));

        // Calculate hybrid score: cosine similarity + keyword boost
        const scored = candidates.map(r => {
            const semScore = vector ? this.cosineSimilarity(vector, r.values) : 0;
            const text = (r.metadata?.text || '').toLowerCase();

            let matchedCount = 0;
            for (const token of promptTokens) {
                if (text.includes(token)) {
                    matchedCount++;
                }
            }

            const keywordRatio = promptTokens.length > 0 ? (matchedCount / promptTokens.length) : 0;
            // Hybrid fusion: semantic score + keyword exact match boost
            const hybridScore = Math.min(1.0, (semScore * 0.4) + (keywordRatio * 0.6) + (matchedCount > 0 ? 0.25 : 0));

            return {
                id: r.id,
                score: hybridScore,
                metadata: r.metadata
            };
        });

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
        this.saveCache();
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
 * Searches vector store for relevant chunks matching the query vector and keywords.
 */
export const queryVectors = async ({ vector, prompt = '', topK = 4, filter = {} }) => {
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

    return await inMemoryStore.query({ vector, prompt, topK, filter });
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

