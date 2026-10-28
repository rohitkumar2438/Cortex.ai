import { createMessage, getMessagesByConversation } from '../services/messageService.js';

export const handleCreateMessage = async (req, res, next) => {
    try {
        const conversationId = req.params.conversationId || req.params.id || req.body.conversationId;
        const { role, content, agent, images, artifact } = req.body;

        const message = await createMessage(req.user.userId, conversationId, {
            role,
            content,
            agent,
            images,
            artifact
        });

        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
};

export const handleGetMessages = async (req, res, next) => {
    try {
        const conversationId = req.params.conversationId || req.params.id;
        const messages = await getMessagesByConversation(req.user.userId, conversationId);
        res.status(200).json(messages);
    } catch (err) {
        next(err);
    }
};

