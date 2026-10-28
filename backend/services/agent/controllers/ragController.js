import { indexDocument, getUploadedDocuments, removeDocument } from '../rag/ragService.js';

/**
 * Handles PDF and TXT document upload and ingestion into RAG vector store.
 */
export const handleUploadDocument = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file uploaded. Please attach a PDF or TXT file under "file".' });
        }

        const userId = req.headers['x-user-id'] || req.body?.userId || req.user?.userId || 'anonymous';
        const conversationId = req.body?.conversationId || 'default';
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname || `uploaded_${Date.now()}`;
        const mimeType = req.file.mimetype || '';

        const result = await indexDocument({
            fileBuffer,
            fileName,
            mimeType,
            userId,
            conversationId
        });

        res.status(200).json({
            success: true,
            message: `Document "${result.docName}" indexed successfully into vector knowledge base.`,
            document: result
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Lists all knowledge documents uploaded for the active user/conversation.
 */
export const handleListDocuments = (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || req.user?.userId || '';
        const conversationId = req.query.conversationId || 'default';

        const docs = getUploadedDocuments(userId, conversationId);
        res.status(200).json({
            success: true,
            documents: docs
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Deletes an uploaded document from the vector store.
 */
export const handleDeleteDocument = async (req, res, next) => {
    try {
        const { docName } = req.params;
        const userId = req.headers['x-user-id'] || req.query.userId || req.user?.userId || '';
        const conversationId = req.query.conversationId || 'default';

        if (!docName) {
            return res.status(400).json({ error: 'Document name parameter is required.' });
        }

        const result = await removeDocument(docName, userId, conversationId);
        res.status(200).json({
            success: true,
            message: `Document "${docName}" removed from knowledge base.`,
            result
        });
    } catch (err) {
        next(err);
    }
};

export default {
    handleUploadDocument,
    handleListDocuments,
    handleDeleteDocument
};

