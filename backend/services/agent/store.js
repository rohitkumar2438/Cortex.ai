import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from 'fs';

let vectorStore = null;

export const initVectorStore = async () => {
    if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY) {
        console.warn("WARNING: Missing GEMINI_API_KEY or PINECONE_API_KEY in environment variables. Vector Store cannot be initialized.");
        return;
    }

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || "cortexai");

        vectorStore = await PineconeStore.fromExistingIndex(
            new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY }),
            { pineconeIndex: index }
        );
        console.log("✅ Strict Pinecone Vector Store initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Pinecone:", error);
        throw error;
    }
};

export const getVectorStore = () => vectorStore;

export const processAndStorePDF = async (filePath) => {
    if (!vectorStore) throw new Error("Vector Store is not initialized. Ensure Pinecone API keys are set.");
    
    // Load PDF
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    
    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    
    // Add to Pinecone vector store
    await vectorStore.addDocuments(splitDocs);
    
    // Cleanup the uploaded file
    fs.unlinkSync(filePath);
    
    return splitDocs.length;
};
