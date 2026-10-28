/**
 * Authentication middleware for Chat Service.
 * Downstream services trust the gateway-propagated 'x-user-id' header.
 * Attaches req.user = { userId } for scoping all queries.
 */
export const requireAuth = (req, res, next) => {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;

    if (!userId) {
        return res.status(401).json({
            error: 'Unauthorized: User identity is required to access chat resources.'
        });
    }

    req.user = {
        userId: String(userId).trim()
    };

    next();
};

export default requireAuth;

