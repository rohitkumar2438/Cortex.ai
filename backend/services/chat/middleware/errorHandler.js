/**
 * Centralized error handling middleware for Chat Service.
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Chat Service Error:', err);

    const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;

