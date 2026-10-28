import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { agentApp } from './graph/graph.js';
import { initVectorDB, processAndStoreDocument, getUserDocuments, deleteUserDocument } from './config/vectorDB.js';

dotenv.config();

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = process.env.PORT || 8003;
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:8004';

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true
}));
app.use(express.json());

// Initialize Vector Database (Qdrant / Pinecone / In-memory)
initVectorDB().catch(e => console.warn('Vector DB startup notice:', e.message));

app.get('/', (req, res) => res.json({ service: 'Agent Service', status: 'Running', engine: 'LangGraph Multi-Agent RAG' }));

// Credit costs per agent type
const AGENT_CREDIT_COSTS = {
    chat: 1,
    search: 2,
    code: 3,
    coding: 3,
    image: 5,
    vision: 4,
    imageAnalyzer: 4,
    pdf: 3,
    pdfRag: 3,
    ppt: 5
};

// Handle document uploads for RAG
app.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const userId = req.body.userId || req.headers['x-user-id'] || 'default';
        const docResult = await processAndStoreDocument({
            filePath: req.file.path,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            userId
        });

        res.json({ 
            success: true, 
            message: `Document "${docResult.fileName}" indexed successfully (${docResult.chunksCount} chunks ready for RAG query)!`,
            ...docResult
        });
    } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({ error: "Failed to process document", details: error.message });
    }
});

// List uploaded knowledge base documents for a user
app.get('/documents', (req, res) => {
    try {
        const userId = req.query.userId || req.headers['x-user-id'] || 'default';
        const documents = getUserDocuments(userId);
        res.json({ success: true, documents });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve documents", details: error.message });
    }
});

// Delete a document from a user's knowledge base
app.delete('/documents/:docId', (req, res) => {
    try {
        const userId = req.query.userId || req.headers['x-user-id'] || 'default';
        const result = deleteUserDocument(userId, req.params.docId);
        res.json({ success: true, message: "Document removed from knowledge base", ...result });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete document", details: error.message });
    }
});

// Main Multi-Agent Run Endpoint
app.post('/run', upload.single('attachment'), async (req, res) => {
    try {
        const { message, threadId = "default", agentType = "chat", userId } = req.body;

        if (!message && !req.file) {
            return res.status(400).json({ error: "message or attachment is required" });
        }

        // Deduct credits if userId is provided
        if (userId) {
            const cost = AGENT_CREDIT_COSTS[agentType] || 1;
            try {
                const deductRes = await fetch(`${BILLING_SERVICE_URL}/deduct`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, creditsToDeduct: cost, agentType })
                });

                if (deductRes.status === 402) {
                    return res.status(402).json({
                        result: "⚠️ You do not have enough credits to use this agent. Please top up your credits in the billing panel.",
                        type: 'chat',
                        insufficientCredits: true
                    });
                }
            } catch (deductErr) {
                console.warn('⚠️ Could not deduct credits (proceeding):', deductErr.message);
            }
        }

        // Invoke LangGraph Orchestration StateGraph
        const stateResult = await agentApp.invoke({
            prompt: message || "",
            agentType: agentType,
            conversationId: threadId,
            userId: userId || req.headers['x-user-id'] || "",
            file: req.file || null
        });

        res.json({
            result: stateResult.aiResponse,
            type: stateResult.agentType || agentType,
            url: stateResult.url || null,
            artifacts: stateResult.artifacts || null,
            sources: stateResult.sources || null
        });

    } catch (error) {
        console.error("LangGraph Agent Error:", error);
        res.status(500).json({ error: "Agent execution failed", details: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Agent Service running on port ${PORT}`));
