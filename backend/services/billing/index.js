import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();
connectDB();

const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000'],
    credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 8004;

// Initialize Razorpay
let razorpay;
try {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
    });
} catch (e) {
    console.warn("Razorpay keys not configured. Running in Mock Mode.");
}

// Predefined Plans
export const PLANS = {
    STARTER: { name: 'Starter', priceINR: 199, credits: 500 },
    PRO: { name: 'Pro', priceINR: 499, credits: 1000 }
};

app.get('/', (req, res) => res.json({ service: 'Billing Service', status: 'Running', plans: PLANS }));

// Deduct credits per agent call
app.post('/deduct', async (req, res) => {
    try {
        const { userId, creditsToDeduct = 1 } = req.body;
        if (!userId) return res.status(400).json({ error: "userId is required" });

        const user = await User.findOne({ uid: userId });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.credits < creditsToDeduct) {
            return res.status(402).json({ 
                error: "Insufficient credits", 
                currentCredits: user.credits, 
                required: creditsToDeduct 
            });
        }

        user.credits -= creditsToDeduct;
        await user.save();

        res.json({ success: true, remainingCredits: user.credits });
    } catch (err) {
        console.error("Deduct credits error:", err);
        res.status(500).json({ error: "Failed to deduct credits", details: err.message });
    }
});

// Route to create a new order
app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = "INR", planName } = req.body;

        const isMockMode = !process.env.RAZORPAY_KEY_ID || 
                           process.env.RAZORPAY_KEY_ID.includes('dummy') || 
                           process.env.RAZORPAY_KEY_ID === "rzp_test_your_key_id_here";

        if (isMockMode) {
            return res.json({
                order: {
                    id: `order_mock_${Date.now()}`,
                    amount: amount * 100,
                    currency,
                },
                key_id: "mock_key_development",
                isMock: true
            });
        }

        const options = {
            amount: Math.round(amount * 100), // in paise
            currency,
            receipt: `rcpt_${Date.now()}`,
            notes: { planName: planName || 'Credits Top-Up' }
        };

        const order = await razorpay.orders.create(options);
        res.json({ order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error("Order creation failed:", error);
        res.status(500).json({ error: "Failed to create order", details: error.message });
    }
});

// Route to verify payment and add credits
app.post('/verify', async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            userId, 
            creditsToAdd = 100, 
            planName = 'Starter',
            isMock 
        } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId is required to add credits" });
        }

        // Mock verification flow
        if (isMock) {
            const user = await User.findOneAndUpdate(
                { uid: userId },
                { 
                    $inc: { credits: creditsToAdd },
                    $set: { plan: planName }
                },
                { new: true }
            );
            return res.json({ 
                success: true, 
                message: "Mock Payment verified successfully!", 
                credits: user?.credits,
                plan: user?.plan
            });
        }

        // Real Razorpay HMAC verification flow
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            const user = await User.findOneAndUpdate(
                { uid: userId },
                { 
                    $inc: { credits: creditsToAdd },
                    $set: { plan: planName }
                },
                { new: true }
            );

            res.json({ 
                success: true, 
                message: "Payment verified successfully!", 
                credits: user?.credits,
                plan: user?.plan
            });
        } else {
            res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
    } catch (error) {
        console.error("Verification failed:", error);
        res.status(500).json({ error: "Payment verification failed", details: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Billing Service started on port ${PORT}`));
