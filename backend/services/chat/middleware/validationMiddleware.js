import mongoose from 'mongoose';

/**
 * Validates MongoDB ObjectId params
 */
export const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: `Invalid ${paramName}: Must be a valid 24-character hexadecimal ObjectId.`
            });
        }
        next();
    };
};

/**
 * Validates conversation creation payload
 */
export const validateCreateConversation = (req, res, next) => {
    const { title } = req.body;
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
        return res.status(400).json({ error: 'Title must be a non-empty string when provided.' });
    }
    next();
};

/**
 * Validates updating conversation title
 */
export const validateUpdateTitle = (req, res, next) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string.' });
    }
    next();
};

/**
 * Validates message creation payload
 */
export const validateCreateMessage = (req, res, next) => {
    const { role, content, images, artifact } = req.body;
    const conversationId = req.params.conversationId || req.body.conversationId;

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'Valid conversationId is required.' });
    }

    if (!role || !['user', 'assistant'].includes(role)) {
        return res.status(400).json({ error: "Role is required and must be 'user' or 'assistant'." });
    }

    if (content === undefined || content === null || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required and must be a non-empty string.' });
    }

    if (images !== undefined && !Array.isArray(images)) {
        return res.status(400).json({ error: 'Images must be an array of URL strings.' });
    }

    if (artifact !== undefined && artifact !== null && typeof artifact !== 'object') {
        return res.status(400).json({ error: 'Artifact must be an object if provided.' });
    }

    next();
};

