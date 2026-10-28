import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { redisClient } from '../config/redis.js';

const CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Creates and persists a message attached to a user's conversation.
 * Image links and artifacts are explicitly persisted to survive reloads.
 */
export const createMessage = async (userId, conversationId, messageData) => {
    // 1. Verify ownership of the conversation
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
        const error = new Error('Conversation not found or unauthorized');
        error.statusCode = 404;
        throw error;
    }

    const { role, content, agent = 'chat', images = [], artifact = null } = messageData;

    // 2. Persist message document
    const message = new Message({
        conversationId,
        role,
        content,
        agent,
        images: Array.isArray(images) ? images : [],
        artifact: artifact || null
    });

    await message.save();

    // 3. Update conversation updatedAt timestamp
    conversation.updatedAt = new Date();
    await conversation.save();

    // 4. Invalidate message list cache
    if (redisClient?.isOpen) {
        try {
            await redisClient.del(`messages:${conversationId}`);
        } catch (err) {
            console.warn('⚠️ Redis cache del error:', err.message);
        }
    }

    return message;
};

/**
 * Retrieves all messages belonging to a conversation, verifying user ownership.
 * Returns persisted image links and artifacts.
 */
export const getMessagesByConversation = async (userId, conversationId) => {
    // 1. Verify ownership
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
        const error = new Error('Conversation not found or unauthorized');
        error.statusCode = 404;
        throw error;
    }

    // 2. Check cache
    if (redisClient?.isOpen) {
        try {
            const cached = await redisClient.get(`messages:${conversationId}`);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (err) {
            console.warn('⚠️ Redis cache get error:', err.message);
        }
    }

    // 3. Query DB
    const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .lean();

    // 4. Cache
    if (redisClient?.isOpen) {
        try {
            await redisClient.setEx(`messages:${conversationId}`, CACHE_TTL_SECONDS, JSON.stringify(messages));
        } catch (err) {
            console.warn('⚠️ Redis cache set error:', err.message);
        }
    }

    return messages;
};

