/**
 * Core RAG Orchestrator for Cortex AI.
 * Handles document ingestion (PDF/TXT parse -> chunk -> embed -> store)
 * and semantic context retrieval for Chat & PDF agents with citation metadata.
 */
import { extractTextFromFile, chunkText } from './chunker.js';
import { embedText, embedDocuments } from './embeddings.js';
import { upsertVectors, queryVectors, listDocuments, deleteDocument } from './vectorStore.js';

/**
 * Ingests a PDF or TXT document, chunks it, generates vector embeddings, and stores it in the vector DB.
 */
export const indexDocument = async ({ fileBuffer, fileName, mimeType, userId = '', conversationId = '' }) => {
    if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty or missing.');
    }

    const safeDocName = fileName ? fileName.trim() : `doc_${Date.now()}`;

    // 1. Extract text
    const { text, pages, info } = await extractTextFromFile(fileBuffer, safeDocName, mimeType);
    if (!text || text.trim().length === 0) {
        throw new Error('No readable text content could be extracted from this document.');
    }

    // 2. Chunk text
    const chunks = chunkText(text, {
        chunkSize: 750,
        chunkOverlap: 120,
        docName: safeDocName,
        userId,
        conversationId
    });

    if (chunks.length === 0) {
        throw new Error('Document content was too brief to generate knowledge chunks.');
    }

    // 3. Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await embedDocuments(chunkTexts);

    // 4. Format records for Vector Store
    const nowIso = new Date().toISOString();
    const records = chunks.map((chunk, index) => ({
        id: `${userId || 'anon'}_${conversationId || 'default'}_${safeDocName}_${index}`,
        values: embeddings[index],
        metadata: {
            chunkIndex: index,
            docName: safeDocName,
            text: chunk.text,
            userId,
            conversationId,
            pages,
            uploadedAt: nowIso
        }
    }));

    // 5. Store in Pinecone / In-Memory Store
    const result = await upsertVectors(records);

    return {
        success: true,
        docName: safeDocName,
        totalChunks: chunks.length,
        pages,
        totalChars: text.length,
        targetStore: result.target,
        uploadedAt: nowIso
    };
};

/**
 * Retrieves semantically relevant context chunks for a given user prompt.
 */
export const retrieveContext = async ({ prompt, userId = '', conversationId = '', topK = 5, minScore = 0.05 }) => {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return { hasContext: false, contextText: '', sources: [] };
    }

    try {
        // 1. Embed query
        const queryVector = await embedText(prompt);

        // 2. Search Vector Store (Hybrid Semantic + Keyword Search)
        const matches = await queryVectors({
            vector: queryVector,
            prompt,
            topK,
            filter: {
                userId: userId || undefined,
                conversationId: (conversationId && conversationId !== 'default') ? conversationId : undefined
            }
        });

        if (!matches || matches.length === 0) {
            return { hasContext: false, contextText: '', sources: [] };
        }

        // 3. Filter by similarity threshold
        const relevantMatches = matches.filter(m => (m.score >= minScore || m.score > 0) && m.metadata?.text);

        if (relevantMatches.length === 0) {
            return { hasContext: false, contextText: '', sources: [] };
        }

        // 4. Compile context text and citation sources
        const uniqueDocs = new Set();
        const sources = [];

        const contextBlocks = relevantMatches.map((m, idx) => {
            const doc = m.metadata.docName || 'uploaded_document';
            uniqueDocs.add(doc);

            sources.push({
                docName: doc,
                score: Math.round(m.score * 100) / 100,
                chunkIndex: m.metadata.chunkIndex ?? idx,
                textSnippet: m.metadata.text.substring(0, 160) + '...'
            });

            return `[DOCUMENT EXCERPT ${idx + 1} | Source: "${doc}"]\n${m.metadata.text}`;
        });

        const contextText = `--- RELEVANT KNOWLEDGE CONTEXT FROM USER'S UPLOADED DOCUMENTS ---\n${contextBlocks.join('\n\n')}\n--- END KNOWLEDGE CONTEXT ---`;

        return {
            hasContext: true,
            contextText,
            sources,
            citedDocs: Array.from(uniqueDocs)
        };
    } catch (err) {
        console.warn('⚠️ RAG context retrieval warning:', err.message);
        return { hasContext: false, contextText: '', sources: [] };
    }
};

/**
 * Lists documents uploaded for this user/conversation.
 */
export const getUploadedDocuments = (userId, conversationId) => {
    return listDocuments({ userId, conversationId });
};

/**
 * Removes an uploaded document from the vector store.
 */
export const removeDocument = async (docName, userId, conversationId) => {
    return await deleteDocument(docName, { userId, conversationId });
};

export default {
    indexDocument,
    retrieveContext,
    getUploadedDocuments,
    removeDocument
};

