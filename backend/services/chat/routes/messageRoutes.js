import express from 'express';
import { handleCreateMessage, handleGetMessages } from '../controllers/messageController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateObjectId, validateCreateMessage } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', validateCreateMessage, handleCreateMessage);
router.get('/:conversationId', validateObjectId('conversationId'), handleGetMessages);

export default router;

