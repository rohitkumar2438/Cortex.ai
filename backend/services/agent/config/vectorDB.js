import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from 'fs';
import path from 'path';

let cloudVectorStore = null;

// Multi-tenant in-memory document store
// Structure: { [userId: string]: { documents: [{ docId, fileName, fileType, uploadedAt, chunkCount }], chunks: [{ pageContent, metadata, docId, tokens }] } }
const userStores = new Map();

/**
 * Get or initialize user store
 */
const getUserStore = (userId = 'default') => {
    const key = userId || 'default';
    if (!userStores.has(key)) {
        userStores.set(key, {
            documents: [],
            chunks: []
        });
    }
    return userStores.get(key);
};

/**
 * Text tokenizer and normalizer for local BM25/TF-IDF search
 */
const tokenize = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1);
};

export const initVectorDB = async () => {
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantKey = process.env.QDRANT_API_KEY;
    const pineconeKey = process.env.PINECONE_API_KEY;

    if (!geminiKey) {
        console.log('💡 RAG Engine: Running in Local Zero-API-Key Hybrid BM25/TF-IDF Vector mode (fast, multi-tenant, 100% private).');
        return null;
    }

    try {
        if (qdrantUrl && qdrantKey) {
            console.log('✅ Initializing Qdrant Cloud Vector Store...');
            const { QdrantVectorStore } = await import("@langchain/qdrant");
            cloudVectorStore = await QdrantVectorStore.fromExistingCollection(
                new GoogleGenerativeAIEmbeddings({ apiKey: geminiKey }),
                {
                    url: qdrantUrl,
                    apiKey: qdrantKey,
                    collectionName: process.env.QDRANT_COLLECTION || "cortexai",
                }
            );
            console.log('✅ Qdrant Vector Store connected successfully.');
            return cloudVectorStore;
        }

        if (pineconeKey) {
            console.log('✅ Initializing Pinecone Vector Store...');
            const { Pinecone } = await import("@pinecone-database/pinecone");
            const { PineconeStore } = await import("@langchain/pinecone");
            const pinecone = new Pinecone({ apiKey: pineconeKey });
            const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || "cortexai");
            cloudVectorStore = await PineconeStore.fromExistingIndex(
                new GoogleGenerativeAIEmbeddings({ apiKey: geminiKey }),
                { pineconeIndex: index }
            );
            console.log('✅ Pinecone Vector Store connected successfully.');
            return cloudVectorStore;
        }

        console.log('💡 RAG Engine: External Vector DB not configured. Using high-performance Local Hybrid BM25 Store.');
        return null;
    } catch (err) {
        console.warn('⚠️ Vector DB initialization notice:', err.message);
        return null;
    }
};

export const getVectorStore = () => cloudVectorStore;

/**
 * Process and index document (PDF, TXT, MD, JSON)
 */
export const processAndStoreDocument = async ({ filePath, originalName, mimeType = '', userId = 'default' }) => {
    const store = getUserStore(userId);
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = path.extname(originalName || filePath).toLowerCase();

    let rawDocs = [];

    if (ext === '.pdf' || mimeType.includes('pdf')) {
        const loader = new PDFLoader(filePath);
        rawDocs = await loader.load();
    } else {
        // Plain text, markdown, json, csv
        const content = fs.readFileSync(filePath, 'utf8');
        rawDocs = [{
            pageContent: content,
            metadata: { source: originalName || filePath, page: 1 }
        }];
    }

    if (!rawDocs || rawDocs.length === 0) {
        throw new Error("No readable text found in the uploaded file.");
    }

    // Split text into overlapping chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 150,
    });
    const splitDocs = await textSplitter.splitDocuments(rawDocs);

    // Prepare enriched chunks
    const indexedChunks = splitDocs.map((doc, idx) => {
        const pageNum = doc.metadata?.loc?.pageNumber || doc.metadata?.page || 1;
        return {
            pageContent: doc.pageContent,
            metadata: {
                ...doc.metadata,
                source: originalName || path.basename(filePath),
                fileName: originalName || path.basename(filePath),
                page: pageNum,
                chunkIndex: idx + 1,
                docId
            },
            docId,
            tokens: tokenize(doc.pageContent)
        };
    });

    // Add to user in-memory store
    store.chunks.push(...indexedChunks);
    store.documents.push({
        docId,
        fileName: originalName || path.basename(filePath),
        fileType: ext || 'text',
        uploadedAt: new Date().toISOString(),
        chunkCount: indexedChunks.length
    });

    // Optionally also index to Cloud Vector Store if connected
    if (cloudVectorStore) {
        try {
            await cloudVectorStore.addDocuments(splitDocs.map((d, i) => ({
                pageContent: d.pageContent,
                metadata: {
                    ...d.metadata,
                    source: originalName || filePath,
                    userId,
                    docId,
                    page: indexedChunks[i]?.metadata?.page || 1
                }
            })));
        } catch (e) {
            console.warn("Could not sync to cloud vector store, kept in local store:", e.message);
        }
    }

    // Cleanup local temp file
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        // ignore
    }

    return {
        docId,
        fileName: originalName || path.basename(filePath),
        chunksCount: indexedChunks.length,
        totalDocsForUser: store.documents.length
    };
};

/**
 * Backward-compatible helper for existing code calling processAndStorePDF
 */
export const processAndStorePDF = async (filePath, userId = 'default', originalName = '') => {
    const res = await processAndStoreDocument({
        filePath,
        originalName: originalName || path.basename(filePath),
        mimeType: 'application/pdf',
        userId
    });
    return res.chunksCount;
};

/**
 * High-precision BM25 & Semantic Retrieval
 */
export const searchDocuments = async (query, options = {}) => {
    const { userId = 'default', k = 4, docId = null } = typeof options === 'object' ? options : { k: options };
    const store = getUserStore(userId);

    // If cloud vector store is available, use it with user metadata filtering if possible
    if (cloudVectorStore) {
        try {
            const results = await cloudVectorStore.similaritySearch(query, k);
            if (results && results.length > 0) {
                return results.map(r => ({
                    pageContent: r.pageContent,
                    metadata: {
                        source: r.metadata?.source || r.metadata?.fileName || 'Document',
                        fileName: r.metadata?.fileName || r.metadata?.source || 'Document',
                        page: r.metadata?.page || r.metadata?.loc?.pageNumber || 1,
                        docId: r.metadata?.docId || ''
                    }
                }));
            }
        } catch (err) {
            console.warn('Cloud vector search failed, falling back to local BM25 search:', err.message);
        }
    }

    // Local BM25 / TF-IDF Retrieval
    let candidateChunks = store.chunks;
    if (docId) {
        candidateChunks = candidateChunks.filter(c => c.docId === docId);
    }

    if (candidateChunks.length === 0) {
        return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
        return candidateChunks.slice(0, k);
    }

    const N = candidateChunks.length;
    // Calculate document frequency (DF) for each query token
    const dfMap = new Map();
    queryTokens.forEach(token => {
        let count = 0;
        candidateChunks.forEach(chunk => {
            if (chunk.tokens.includes(token)) count++;
        });
        dfMap.set(token, count);
    });

    // Average chunk length in tokens
    const totalTokens = candidateChunks.reduce((acc, c) => acc + c.tokens.length, 0);
    const avgDocLength = totalTokens / (N || 1);

    // BM25 parameters
    const k1 = 1.5;
    const b = 0.75;
    const lowerQuery = query.toLowerCase();

    const scored = candidateChunks.map(chunk => {
        let score = 0;
        const chunkText = chunk.pageContent.toLowerCase();

        // Exact phrase boost (huge relevancy indicator)
        if (chunkText.includes(lowerQuery)) {
            score += 10.0;
        }

        const chunkLen = chunk.tokens.length;
        const tokenCounts = new Map();
        chunk.tokens.forEach(t => tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1));

        queryTokens.forEach(token => {
            const tf = tokenCounts.get(token) || 0;
            if (tf > 0) {
                const df = dfMap.get(token) || 1;
                // Standard BM25 IDF formulation
                const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
                const tfComponent = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunkLen / (avgDocLength || 1))));
                score += idf * tfComponent;
            }
        });

        return { chunk, score };
    });

    // Filter out zero-score chunks unless everything is zero
    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.filter(s => s.score > 0.05);
    const finalChunks = (relevant.length > 0 ? relevant : scored).slice(0, k);

    return finalChunks.map(item => ({
        pageContent: item.chunk.pageContent,
        metadata: item.chunk.metadata,
        score: Math.round(item.score * 100) / 100
    }));
};

/**
 * Get all uploaded documents for a user
 */
export const getUserDocuments = (userId = 'default') => {
    const store = getUserStore(userId);
    return store.documents;
};

/**
 * Delete a specific document and its chunks
 */
export const deleteUserDocument = (userId = 'default', docId) => {
    const store = getUserStore(userId);
    store.documents = store.documents.filter(d => d.docId !== docId);
    store.chunks = store.chunks.filter(c => c.docId !== docId);
    return { success: true, remaining: store.documents.length };
};
