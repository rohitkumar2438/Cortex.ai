import express from 'express';
import path from 'path';
import fs from 'fs';
import { handleRun, handleStream } from '../controllers/agentController.js';
import ragRoutes from './ragRoutes.js';

const router = express.Router();

router.post('/run', handleRun);
router.post('/stream', handleStream);
router.get('/stream', handleStream);

// RAG Endpoints (/agent/rag/upload, /agent/rag/documents, /agent/rag/documents/:docName)
router.use('/rag', ragRoutes);

// Dedicated download endpoint for locally stored generated files (PDF, PPT, Image)
router.get('/downloads/:filename', (req, res) => {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = path.resolve(process.cwd(), 'uploads', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
    } else {
        res.status(404).json({ error: 'File not found or expired.' });
    }
});

export default router;
