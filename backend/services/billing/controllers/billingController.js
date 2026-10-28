import {
    createCreditOrder,
    verifyAndApplyCredits,
    deductAgentCredits,
    processWebhook
} from '../services/billingService.js';
import { listUserTransactions } from '../services/transactionService.js';
import { CREDIT_PACKS } from '../config/creditPacks.js';

export const handleGetPacks = (req, res) => {
    res.status(200).json({
        success: true,
        packs: Object.values(CREDIT_PACKS)
    });
};

export const handleCreateOrder = async (req, res, next) => {
    try {
        const { packId = 'pack_100', userId: bodyUserId } = req.body;
        const userId = req.headers['x-user-id'] || bodyUserId || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User identity is required to create a billing order.' });
        }

        const orderData = await createCreditOrder(userId, packId);
        res.status(201).json(orderData);
    } catch (err) {
        next(err);
    }
};

export const handleVerifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isMock, userId: bodyUserId } = req.body;
        const userId = req.headers['x-user-id'] || bodyUserId || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User identity is required to verify payment.' });
        }

        const result = await verifyAndApplyCredits(userId, {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            isMock
        });

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

export const handleDeductCredits = async (req, res, next) => {
    try {
        const { userId: bodyUserId, agent = 'chat', creditsToDeduct } = req.body;
        const userId = req.headers['x-user-id'] || bodyUserId;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required for credit deduction.' });
        }

        const result = await deductAgentCredits(userId, agent, creditsToDeduct);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

export const handleGetTransactions = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User identity required to view transactions.' });
        }

        const transactions = await listUserTransactions(userId);
        res.status(200).json({ success: true, transactions });
    } catch (err) {
        next(err);
    }
};

export const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const result = await processWebhook(req.rawBody || JSON.stringify(req.body), signature);
        res.status(200).json(result);
    } catch (err) {
        console.error('Webhook processing error:', err.message);
        res.status(400).json({ error: err.message });
    }
};
