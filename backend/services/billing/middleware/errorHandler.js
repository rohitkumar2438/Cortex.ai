/**
 * Centralized Error Handler for Billing Service
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Billing Service Error:', err);

    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    const message = err.message || 'Internal Billing Service Error';

    res.status(statusCode).json({
        error: message,
        requiredCredits: err.requiredCredits,
        currentCredits: err.currentCredits,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;
