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
import { openApiSpec, getSwaggerHtml } from './swagger.js';

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

// Request Correlation ID Middleware (Industry standard for microservice tracing)
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
});

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

// 7. Interactive Swagger / OpenAPI Documentation
app.get('/docs/openapi.json', (req, res) => {
    res.json(openApiSpec);
});

app.get('/docs', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getSwaggerHtml());
});

app.get('/api-docs', (req, res) => {
    res.redirect('/docs');
});

// 8. Gateway Health and System Observability
app.get('/health', (req, res) => {
    res.json({
        service: 'Cortex AI Gateway',
        status: 'UP',
        timestamp: new Date().toISOString(),
        user: req.user ? { userId: req.user.userId, email: req.user.email } : null
    });
});

// Centralized Multi-Microservice Observability Aggregator
app.get('/health/all', async (req, res) => {
    const services = [
        { name: 'auth', url: `${AUTH_SERVICE_URL}/health` },
        { name: 'chat', url: `${CHAT_SERVICE_URL}/health` },
        { name: 'agent', url: `${AGENT_SERVICE_URL}/health` },
        { name: 'billing', url: `${BILLING_SERVICE_URL}/health` }
    ];

    const checkService = async ({ name, url }) => {
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            const latency = `${Date.now() - start}ms`;
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                return { name, status: 'UP', latency, details: data };
            }
            return { name, status: 'DEGRADED', latency, httpStatus: response.status };
        } catch (err) {
            return { name, status: 'DOWN', latency: `${Date.now() - start}ms`, error: err.message };
        }
    };

    const results = await Promise.all(services.map(checkService));
    const allUp = results.every(s => s.status === 'UP');

    res.status(allUp ? 200 : 207).json({
        systemStatus: allUp ? 'ALL_SYSTEMS_OPERATIONAL' : 'PARTIALLY_DEGRADED',
        gateway: {
            status: 'UP',
            port: PORT,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        },
        services: results.reduce((acc, s) => {
            acc[s.name] = s;
            return acc;
        }, {}),
        timestamp: new Date().toISOString()
    });
});

// API Routes Catalog for Enterprise Documentation
app.get('/api/catalog', (req, res) => {
    res.json({
        platform: 'Cortex AI Multi-Agent Platform',
        version: '1.0.0',
        architecture: 'Microservices with API Gateway & LangGraph',
        endpoints: {
            auth: {
                login: 'POST /auth/login (Firebase ID Token verification)',
                profile: 'GET /auth/profile',
                logout: 'POST /auth/logout'
            },
            chat: {
                conversations: 'GET /chat/conversations',
                createConversation: 'POST /chat/conversations',
                messages: 'GET /chat/conversations/:id/messages',
                sendMessage: 'POST /chat/conversations/:id/messages'
            },
            agent: {
                run: 'POST /agent/run (Synchronous multi-agent execution)',
                stream: 'POST /agent/stream (SSE streaming Thinking -> Reasoning -> Generating)',
                ragUpload: 'POST /agent/rag/upload (PDF/TXT knowledge ingestion)',
                ragDocuments: 'GET /agent/rag/documents (List indexed documents)',
                ragDelete: 'DELETE /agent/rag/documents/:docName'
            },
            billing: {
                status: 'GET /billing/status (Active user credits)',
                order: 'POST /billing/order (Razorpay order creation for packs)',
                verify: 'POST /billing/verify (Payment signature verification)'
            },
            system: {
                health: 'GET /health',
                healthAll: 'GET /health/all (Aggregated microservice observability)',
                catalog: 'GET /api/catalog'
            }
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Hello from Cortex AI Gateway',
        version: '1.0.0',
        docs: '/api/catalog',
        health: '/health/all'
    });
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
