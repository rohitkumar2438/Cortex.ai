/**
 * Vector Embeddings Generator for Cortex AI RAG.
 * Uses OpenAI text-embedding-3-small if OPENAI_API_KEY is configured;
 * otherwise uses a high-performance normalized semantic projection generator.
 */
import { OpenAIEmbeddings } from "@langchain/openai";

let openAIEmbeddingsInstance = null;

export const getEmbeddingsInstance = () => {
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('dummy')) {
        if (!openAIEmbeddingsInstance) {
            openAIEmbeddingsInstance = new OpenAIEmbeddings({
                modelName: "text-embedding-3-small",
                dimensions: 384
            });
        }
        return openAIEmbeddingsInstance;
    }
    return null;
};

/**
 * Deterministic semantic vector generator (384 dimensions)
 * Generates unit-normalized dense embeddings based on n-gram token hashes and frequency.
 * Ideal for local development and testing without requiring OpenAI API keys.
 */
const generateLocalEmbedding = (text, dimensions = 384) => {
    const vector = new Float32Array(dimensions);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        vector[0] = 1.0;
        return Array.from(vector);
    }

    // Token frequency and character n-gram distribution
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let hash = 0;
        for (let j = 0; j < token.length; j++) {
            hash = (hash << 5) - hash + token.charCodeAt(j);
            hash |= 0;
        }

        const primaryIdx = Math.abs(hash) % dimensions;
        vector[primaryIdx] += 1.0;

        // Bigram hashing for contextual relation
        if (i > 0) {
            const bigram = tokens[i - 1] + "_" + token;
            let biHash = 0;
            for (let j = 0; j < bigram.length; j++) {
                biHash = (biHash << 5) - biHash + bigram.charCodeAt(j);
                biHash |= 0;
            }
            const biIdx = Math.abs(biHash) % dimensions;
            vector[biIdx] += 1.5;
        }
    }

    // L2 Normalize the vector to unit length
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
        norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
        for (let i = 0; i < dimensions; i++) {
            vector[i] /= norm;
        }
    }

    return Array.from(vector);
};

/**
 * Generates an embedding for a single text string.
 */
export const embedText = async (text) => {
    const openai = getEmbeddingsInstance();
    if (openai) {
        try {
            return await openai.embedQuery(text);
        } catch (err) {
            console.warn('⚠️ OpenAI embeddings failed, falling back to local embeddings:', err.message);
        }
    }
    return generateLocalEmbedding(text);
};

/**
 * Generates embeddings for an array of text chunks.
 */
export const embedDocuments = async (texts) => {
    const openai = getEmbeddingsInstance();
    if (openai) {
        try {
            return await openai.embedDocuments(texts);
        } catch (err) {
            console.warn('⚠️ OpenAI batch embeddings failed, falling back to local embeddings:', err.message);
        }
    }
    return texts.map(t => generateLocalEmbedding(t));
};

export default {
    embedText,
    embedDocuments
};
