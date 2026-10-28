import express from 'express';
import dotenv from 'dotenv';
import proxy from 'express-http-proxy';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { initRedis, getSession } from '../shared/redisClient.js';
import { COOKIE_NAME } from '../shared/constants.js';

dotenv.config();

// Connect or initialize shared Redis (with in-memory fallback)
initRedis();

const app = express();
const PORT = process.env.PORT || 8000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8001';
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:8002';
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8003';
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:8004';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Security Headers with Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Allow frontend dev tooling and external assets
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. Rate Limiting Middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use(limiter);

// 3. CORS Configuration
app.use(cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-user-id']
}));

// 4. Logging & Parsing
app.use(morgan('dev'));
app.use(cookieParser());

// 5. Gateway Session-to-User Auth Middleware (cookie -> Redis session -> req.user with userId)
app.use(async (req, res, next) => {
    const sessionId = req.cookies?.[COOKIE_NAME] || req.headers['x-session-id'];
    if (sessionId) {
        try {
            const session = await getSession(sessionId);
            if (session) {
                const userId = session.userId || session.firebaseUid || session.uid || session._id;
                req.user = {
                    ...session,
                    userId
                };
            }
        } catch (e) {
            console.warn('⚠️ Gateway session resolution warning:', e.message);
        }
    }
    next();
});

// Helper for decorating downstream proxy requests with user identity headers
const createProxyOptions = (customOptions = {}) => ({
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        const userId = srcReq.user?.userId || srcReq.headers['x-user-id'] || '';
        if (userId) {
            proxyReqOpts.headers['x-user-id'] = userId;
        }
        if (srcReq.user) {
            proxyReqOpts.headers['x-user-email'] = srcReq.user.email || '';
            proxyReqOpts.headers['x-user-name'] = encodeURIComponent(srcReq.user.name || '');
        }
        return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyRes, proxyResData) => {
        const origin = userReq.headers.origin;
        if (origin) {
            headers['access-control-allow-origin'] = origin;
            headers['access-control-allow-credentials'] = 'true';
        }
        return headers;
    },
    ...customOptions
});

// 6. Proxy Routes to Microservices
app.use('/auth', proxy(AUTH_SERVICE_URL, createProxyOptions()));
app.use('/chat', proxy(CHAT_SERVICE_URL, createProxyOptions()));
app.use('/agent', proxy(AGENT_SERVICE_URL, createProxyOptions({ parseReqBody: false })));
app.use('/billing', proxy(BILLING_SERVICE_URL, createProxyOptions()));

// 7. Gateway Health and Info
app.get('/health', (req, res) => {
    res.json({
        service: 'Cortex AI Gateway',
        status: 'UP',
        timestamp: new Date().toISOString(),
        user: req.user ? { userId: req.user.userId, email: req.user.email } : null
    });
});

app.get('/', (req, res) => {
    res.json({ message: 'Hello from Cortex AI Gateway', version: '1.0.0' });
});

// Centralized error handling
app.use((err, req, res, next) => {
    console.error('❌ Gateway Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Gateway Error'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Cortex Gateway running at http://localhost:${PORT}`);
});

export default app;
