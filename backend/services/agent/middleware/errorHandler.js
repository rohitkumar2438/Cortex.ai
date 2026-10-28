/**
 * Centralized Error Handler for Agent Service
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Agent Service Error:', err);

    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    const message = err.message || 'Internal Agent Service Error';

    res.status(statusCode).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;
