import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

// 1. Shared Utilities & Redis
import { initRedis, getSession } from './shared/redisClient.js';
import { COOKIE_NAME } from './shared/constants.js';
import connectDB from './shared/db.js';

// 2. Microservice Route Handlers
import authRoutes from './services/auth/routes/authRoutes.js';
import conversationRoutes from './services/chat/routes/conversationRoutes.js';
import messageRoutes from './services/chat/routes/messageRoutes.js';
import agentRoutes from './services/agent/routes/agentRoutes.js';
import billingRoutes from './services/billing/routes/billingRoutes.js';

dotenv.config();

// Initialize DB and Redis (with automatic in-memory fallback)
connectDB(process.env.MONGO_URI, 'Unified Server');
initRedis();

const app = express();
const PORT = process.env.PORT || 8000;
const CLIENT_URL = process.env.CLIENT_URL || 'https://cortex-ai-roan.vercel.app';

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = [
    CLIENT_URL,
    'https://cortex-ai-roan.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(null, true); // Permissive for production deployment
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-user-id']
}));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Correlation ID & Session Middleware
app.use(async (req, res, next) => {
    const sessionId = req.cookies?.[COOKIE_NAME] || req.headers['x-session-id'];
    if (sessionId) {
        try {
            const session = await getSession(sessionId);
            if (session) {
                const userId = session.userId || session.firebaseUid || session.uid || session._id;
                req.user = { ...session, userId };
                req.headers['x-user-id'] = userId;
            }
        } catch (e) {}
    }
    next();
});

// Health Checks
app.get('/', (req, res) => {
    res.json({
        service: 'Cortex AI Production Cloud Backend',
        status: 'UP',
        architecture: 'Unified Microservice Engine',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'UP', port: PORT });
});

// Mount All Backend Microservice Routes
app.use('/auth', authRoutes);
app.use('/conversations', conversationRoutes);
app.use('/messages', messageRoutes);
app.use('/agent', agentRoutes);
app.use('/billing', billingRoutes);

// Centralized Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(err.statusCode || err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Cortex AI Unified Backend running on port ${PORT}`);
});

export default app;

