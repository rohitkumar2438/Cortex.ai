import { getModel } from '../config/llmModels.js';
import { searchDocuments, processAndStoreDocument, getUserDocuments } from '../config/vectorDB.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const runPdfRagAgent = async (prompt, options = {}) => {
    const { userId = 'default', file = null } = typeof options === 'object' ? options : {};

    // 1. If a document file was uploaded alongside this query, index it immediately
    if (file && file.path) {
        try {
            await processAndStoreDocument({
                filePath: file.path,
                originalName: file.originalname || 'uploaded_document.pdf',
                mimeType: file.mimetype,
                userId
            });
        } catch (uploadErr) {
            console.error("Failed to index inline uploaded file:", uploadErr);
        }
    }

    // 2. Check if the user has any uploaded documents
    const userDocs = getUserDocuments(userId);
    if ((!userDocs || userDocs.length === 0) && !file) {
        return {
            result: "📂 **No documents found in your knowledge base.**\n\nPlease upload a PDF or document first using the **'Upload Document (RAG)'** button in the sidebar or attaching a file to your prompt. Once uploaded, I'll be able to answer questions and analyze its contents for you!",
            sources: [],
            type: 'pdf'
        };
    }

    // 3. Retrieve relevant chunks using hybrid BM25/Vector retrieval
    const matches = await searchDocuments(prompt, { userId, k: 4 });

    if (!matches || matches.length === 0) {
        return {
            result: `🔍 I searched across your uploaded documents (${userDocs.map(d => d.fileName).join(', ')}), but couldn't find any relevant sections answering your question: *"${prompt}"*.\n\nTry rephrasing your question or asking about topics covered in the document.`,
            sources: [],
            type: 'pdf'
        };
    }

    // 4. Format context excerpts with source attribution
    const context = matches.map((m, idx) => {
        const sourceName = m.metadata?.fileName || m.metadata?.source || 'Uploaded Document';
        const pageNum = m.metadata?.page || 1;
        return `[Excerpt ${idx + 1} | Source: "${sourceName}", Page: ${pageNum}]:\n${m.pageContent}`;
    }).join("\n\n---\n\n");

    const model = getModel('chat');
    const systemPrompt = new SystemMessage(
        `You are Cortex AI's Document Intelligence & RAG Agent.
Your job is to answer the user's question accurately using ONLY the provided document excerpts below.

Guidelines:
1. Ground your answers strictly in the provided excerpts.
2. If the excerpts do not contain the answer, politely and clearly state that the document does not contain that information. Do not hallucinate or extrapolate facts not present.
3. At the end of your explanation, or inline where appropriate, cite the source name and page number (e.g. "[Source: report.pdf, Page 2]").
4. Format your answer cleanly using markdown with bold headings and bullet points where helpful.

--- DOCUMENT EXCERPTS ---
${context}`
    );

    const response = await model.invoke([
        systemPrompt,
        new HumanMessage(prompt)
    ]);

    // 5. Structure source metadata to return to frontend
    const sources = matches.map(m => ({
        fileName: m.metadata?.fileName || m.metadata?.source || 'Document',
        page: m.metadata?.page || 1,
        excerpt: (m.pageContent || '').substring(0, 150).replace(/\s+/g, ' ').trim() + '...'
    }));

    return {
        result: response.content,
        sources,
        type: 'pdf'
    };
};
