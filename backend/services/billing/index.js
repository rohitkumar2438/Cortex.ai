import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import billingRoutes from './routes/billingRoutes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

// Connect MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 8004;

// 1. Security & Logging
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-user-id', 'x-razorpay-signature']
}));

app.use(morgan('dev'));

// Capture raw body for webhook verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// 2. Health & Status
app.get('/health', (req, res) => {
    res.json({ service: 'Billing Service', status: 'UP', port: PORT });
});

app.get('/', (req, res) => {
    res.json({ service: 'Billing Service', status: 'Running', engine: 'Razorpay Credit Gateway' });
});

// 3. Mount Routes (available both at root and /billing)
app.use('/billing', billingRoutes);
app.use('/', billingRoutes);

// 4. Centralized Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Billing Service running on port ${PORT}`);
});

export default app;
