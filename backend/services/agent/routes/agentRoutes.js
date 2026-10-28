import express from 'express';
import { handleRun, handleStream } from '../controllers/agentController.js';

const router = express.Router();

router.post('/run', handleRun);
router.post('/stream', handleStream);
router.get('/stream', handleStream);

export default router;

