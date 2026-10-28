import {
    createConversation,
    listConversations,
    getConversation,
    updateConversationTitle,
    deleteConversation
} from '../services/conversationService.js';

export const handleCreateConversation = async (req, res, next) => {
    try {
        const { title } = req.body;
        const conversation = await createConversation(req.user.userId, title);
        res.status(201).json(conversation);
    } catch (err) {
        next(err);
    }
};

export const handleListConversations = async (req, res, next) => {
    try {
        const conversations = await listConversations(req.user.userId);
        res.status(200).json(conversations);
    } catch (err) {
        next(err);
    }
};

export const handleGetConversation = async (req, res, next) => {
    try {
        const conversation = await getConversation(req.user.userId, req.params.id);
        res.status(200).json(conversation);
    } catch (err) {
        next(err);
    }
};

export const handleUpdateTitle = async (req, res, next) => {
    try {
        const { title } = req.body;
        const updated = await updateConversationTitle(req.user.userId, req.params.id, title);
        res.status(200).json(updated);
    } catch (err) {
        next(err);
    }
};

export const handleDeleteConversation = async (req, res, next) => {
    try {
        const result = await deleteConversation(req.user.userId, req.params.id);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

