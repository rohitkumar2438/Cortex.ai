import express from 'express';
import multer from 'multer';
import {
    handleUploadDocument,
    handleListDocuments,
    handleDeleteDocument
} from '../controllers/ragController.js';

const router = express.Router();

// Configure Multer for in-memory processing up to 20MB
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.txt', '.md', '.csv'];
        const isAllowed = allowedTypes.some(ext => file.originalname.toLowerCase().endsWith(ext));
        if (isAllowed || file.mimetype.includes('pdf') || file.mimetype.includes('text')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, and Markdown files are supported for RAG knowledge upload.'));
        }
    }
});

router.post('/upload', upload.single('file'), handleUploadDocument);
router.get('/documents', handleListDocuments);
router.delete('/documents/:docName', handleDeleteDocument);

export default router;

