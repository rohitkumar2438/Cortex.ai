import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import agentRoutes from './routes/agentRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { initRedis } from '../../shared/redisClient.js';

dotenv.config();

// Connect to Shared Redis (with automatic in-memory fallback)
initRedis();

const app = express();
const PORT = process.env.PORT || 8003;

// 1. Security & Logging Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-user-id']
}));

app.use(morgan('dev'));
app.use(express.json());

// 2. Health & Status
app.get('/health', (req, res) => {
    res.json({
        service: 'Agent Service',
        status: 'UP',
        engine: 'LangGraph Multi-Agent Orchestration',
        port: PORT
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'Agent Service',
        status: 'Running',
        engine: 'LangGraph Multi-Agent (Chat & Tavily Search)'
    });
});

// 3. Mount Agent Routes (available both at root and /agent)
app.use('/agent', agentRoutes);
app.use('/', agentRoutes);

// 4. Centralized Error Handling
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Cortex Agent Service running on port ${PORT}`);
});

export default app;
