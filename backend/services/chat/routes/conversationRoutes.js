import express from 'express';
import {
    handleCreateConversation,
    handleListConversations,
    handleGetConversation,
    handleUpdateTitle,
    handleDeleteConversation
} from '../controllers/conversationController.js';
import {
    handleCreateMessage,
    handleGetMessages
} from '../controllers/messageController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
    validateObjectId,
    validateCreateConversation,
    validateUpdateTitle,
    validateCreateMessage
} from '../middleware/validationMiddleware.js';

const router = express.Router();

// All conversation routes are scoped to authenticated user
router.use(requireAuth);

// Conversation CRUD
router.post('/', validateCreateConversation, handleCreateConversation);
router.get('/', handleListConversations);

router.get('/:id', validateObjectId('id'), handleGetConversation);
router.patch('/:id/title', validateObjectId('id'), validateUpdateTitle, handleUpdateTitle);
router.put('/:id/title', validateObjectId('id'), validateUpdateTitle, handleUpdateTitle);
router.delete('/:id', validateObjectId('id'), handleDeleteConversation);

// Scoped Messages under conversation
router.get('/:id/messages', validateObjectId('id'), handleGetMessages);
router.post('/:id/messages', validateObjectId('id'), validateCreateMessage, handleCreateMessage);
router.post('/:id/message', validateObjectId('id'), validateCreateMessage, handleCreateMessage); // Backward compatibility alias

export default router;

