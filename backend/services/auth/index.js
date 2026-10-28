import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import connectDB from './config/db.js';
import { initRedis } from '../../shared/redisClient.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

// Connect DB and Redis
connectDB();
initRedis();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Base status route
app.get('/', (req, res) => {
    res.json({ service: 'Auth Service', status: 'Running', port: PORT });
});

// Mount auth routes (accessible at / or /auth for direct and proxied calls)
app.use('/auth', authRoutes);
app.use('/', authRoutes);

// Centralized error handling
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Auth Service running on port ${PORT}`);
});

export default app;
