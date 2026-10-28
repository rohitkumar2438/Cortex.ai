import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { redisClient } from '../config/redis.js';

const CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Creates a new conversation for the authenticated user.
 */
export const createConversation = async (userId, title = 'New Chat') => {
    const conversation = new Conversation({
        userId,
        title: title || 'New Chat'
    });

    await conversation.save();

    if (redisClient?.isOpen) {
        try {
            await redisClient.setEx(`conv:${conversation._id}`, CACHE_TTL_SECONDS, JSON.stringify(conversation));
        } catch (err) {
            console.warn('⚠️ Redis cache error:', err.message);
        }
    }

    return conversation;
};

/**
 * Lists all conversations belonging to the authenticated user.
 */
export const listConversations = async (userId) => {
    return await Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .lean();
};

/**
 * Retrieves a single conversation by ID, verifying user ownership.
 */
export const getConversation = async (userId, conversationId) => {
    // 1. Try cache
    if (redisClient?.isOpen) {
        try {
            const cached = await redisClient.get(`conv:${conversationId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.userId === userId) {
                    return parsed;
                }
            }
        } catch (err) {
            console.warn('⚠️ Redis cache get error:', err.message);
        }
    }

    // 2. Query DB
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
    }

    // 3. Cache result
    if (redisClient?.isOpen) {
        try {
            await redisClient.setEx(`conv:${conversationId}`, CACHE_TTL_SECONDS, JSON.stringify(conversation));
        } catch (err) {
            console.warn('⚠️ Redis cache set error:', err.message);
        }
    }

    return conversation;
};

/**
 * Updates the title of an existing conversation scoped to the user.
 */
export const updateConversationTitle = async (userId, conversationId, title) => {
    const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, userId },
        { title: title.trim() },
        { new: true, runValidators: true }
    );

    if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
    }

    if (redisClient?.isOpen) {
        try {
            await redisClient.setEx(`conv:${conversationId}`, CACHE_TTL_SECONDS, JSON.stringify(conversation));
        } catch (err) {
            console.warn('⚠️ Redis cache update error:', err.message);
        }
    }

    return conversation;
};

/**
 * Deletes a conversation and all its associated messages.
 */
export const deleteConversation = async (userId, conversationId) => {
    const conversation = await Conversation.findOneAndDelete({ _id: conversationId, userId });

    if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
    }

    // Delete all associated messages
    await Message.deleteMany({ conversationId });

    // Evict cache
    if (redisClient?.isOpen) {
        try {
            await redisClient.del(`conv:${conversationId}`);
            await redisClient.del(`messages:${conversationId}`);
        } catch (err) {
            console.warn('⚠️ Redis cache del error:', err.message);
        }
    }

    return { success: true, message: 'Conversation and messages deleted successfully.' };
};

