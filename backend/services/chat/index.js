import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

// Connect Database & Cache
connectDB();
connectRedis();

const app = express();
const PORT = process.env.PORT || 8002;

// Security and Logging Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-user-id']
}));
app.use(morgan('dev'));
app.use(express.json());

// Service status / health
app.get('/health', (req, res) => {
    res.json({ service: 'Chat Service', status: 'UP', port: PORT });
});

// Mount Routes (Available both at root and /conversations for gateway flexibility)
app.use('/conversations', conversationRoutes);
app.use('/messages', messageRoutes);
app.use('/', conversationRoutes);

// Centralized error handling
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Chat Service running on port ${PORT}`);
});

export default app;
