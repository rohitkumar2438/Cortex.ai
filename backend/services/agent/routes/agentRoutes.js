import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { handleRun, handleStream } from '../controllers/agentController.js';
import ragRoutes from './ragRoutes.js';

const router = express.Router();

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

router.post('/run', handleRun);
router.post('/stream', handleStream);
router.get('/stream', handleStream);

// Whisper AI Voice Transcription Endpoint (Groq whisper-large-v3-turbo)
router.post('/transcribe', memoryUpload.single('audio'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'Audio file buffer is required.' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Groq API key not configured for Whisper.' });
        }

        const formData = new FormData();
        const mimeType = req.file.mimetype || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const audioBlob = new Blob([req.file.buffer], { type: mimeType });
        formData.append('file', audioBlob, `speech.${extension}`);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('temperature', '0');
        // Prevent silence hallucination by setting acoustic prompt context
        formData.append('prompt', 'A question, coding prompt, technical query, or conversation.');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!groqRes.ok) {
            const errData = await groqRes.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Whisper API failed (${groqRes.status})`);
        }

        const data = await groqRes.json();
        const transcription = (data.text || '').trim();
        console.log(`🎙️ [Whisper AI] Transcribed: "${transcription}" (audio size: ${req.file.size} bytes)`);

        const clean = transcription.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const SILENCE_CLEAN = [
            'thank you',
            'thank you so much',
            'thank you very much',
            'thank you for watching',
            'thanks for watching',
            'subtitles by',
            'subtitles',
            'bye',
            'you',
            ''
        ];

        if (!clean || SILENCE_CLEAN.includes(clean)) {
            console.warn(`⚠️ [Whisper AI] Detected silence/empty audio (hallucination filtered: "${transcription}")`);
            return res.json({
                success: false,
                text: '',
                error: 'No clear speech detected. Please speak louder into your microphone.'
            });
        }

        res.json({
            success: true,
            text: transcription
        });
    } catch (err) {
        console.error('❌ Whisper transcription failure:', err.message);
        res.status(500).json({ error: err.message || 'Audio transcription failed' });
    }
});

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
