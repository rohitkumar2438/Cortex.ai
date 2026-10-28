import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { getRazorpay } from '../config/razorpay.js';
import { CREDIT_PACKS, getAgentCreditCost } from '../config/creditPacks.js';

/**
 * Creates a Razorpay order for purchasing credit packs (100 / 500 / 1000).
 */
export const createCreditOrder = async (userId, packId = 'pack_100') => {
    const pack = CREDIT_PACKS[packId] || CREDIT_PACKS.pack_100;
    const razorpay = getRazorpay();

    const amountInPaise = pack.amountINR * 100;
    const receipt = `rcpt_${Date.now()}_${userId.slice(-6)}`;

    // Create order with Razorpay
    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
            userId,
            packId: pack.id,
            credits: pack.credits
        }
    });

    // Record created transaction
    await Transaction.create({
        userId,
        orderId: order.id,
        packId: pack.id,
        creditsAdded: pack.credits,
        amount: pack.amountINR,
        currency: 'INR',
        status: 'created',
        metadata: { receipt }
    });

    return {
        order,
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_cortex',
        pack,
        isMock: !!razorpay.isMock
    };
};

/**
 * Verifies Razorpay payment signature and adds credits atomically.
 */
export const verifyAndApplyCredits = async (userId, paymentData) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isMock } = paymentData;

    // 1. Look up existing transaction record
    const transaction = await Transaction.findOne({ orderId: razorpay_order_id });
    if (!transaction) {
        const error = new Error('Order transaction not found.');
        error.statusCode = 404;
        throw error;
    }

    // 2. Idempotency check: avoid double crediting
    if (transaction.status === 'captured') {
        const existingUser = await User.findOne({ $or: [{ firebaseUid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] });
        return {
            success: true,
            message: 'Payment was already verified and credited.',
            credits: existingUser?.credits,
            transaction
        };
    }

    // 3. Signature verification (skip if development mock mode)
    if (!isMock && !process.env.RAZORPAY_KEY_ID?.includes('dummy')) {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            transaction.status = 'failed';
            await transaction.save();

            const error = new Error('Invalid payment signature. Verification failed.');
            error.statusCode = 400;
            throw error;
        }
    }

    // 4. Atomically credit user account
    const pack = CREDIT_PACKS[transaction.packId] || CREDIT_PACKS.pack_100;
    const creditsToAdd = transaction.creditsAdded || pack.credits;

    const updatedUser = await User.findOneAndUpdate(
        { $or: [{ firebaseUid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] },
        {
            $inc: { credits: creditsToAdd },
            $set: { plan: pack.name }
        },
        { new: true }
    );

    if (!updatedUser) {
        const error = new Error('User not found to apply credits.');
        error.statusCode = 404;
        throw error;
    }

    // 5. Update transaction record
    transaction.paymentId = razorpay_payment_id || `pay_mock_${Date.now()}`;
    transaction.signature = razorpay_signature || 'mock_signature';
    transaction.status = 'captured';
    await transaction.save();

    return {
        success: true,
        message: 'Payment verified and credits added successfully!',
        credits: updatedUser.credits,
        plan: updatedUser.plan,
        transaction
    };
};

/**
 * Deducts credits per agent call. Atomically blocks if balance is insufficient.
 */
export const deductAgentCredits = async (userId, agent = 'chat', customCost = null) => {
    const cost = customCost !== null ? Number(customCost) : getAgentCreditCost(agent);

    // Find user
    const user = await User.findOne({
        $or: [{ firebaseUid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }]
    });

    if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    // Insufficient credits check
    if (user.credits < cost) {
        const error = new Error(`Insufficient credits. You need ${cost} credits to run the ${agent.toUpperCase()} agent, but you have ${user.credits}.`);
        error.statusCode = 402; // Payment Required
        error.currentCredits = user.credits;
        error.requiredCredits = cost;
        throw error;
    }

    // Atomic deduction
    const updatedUser = await User.findOneAndUpdate(
        {
            _id: user._id,
            credits: { $gte: cost }
        },
        {
            $inc: { credits: -cost }
        },
        { new: true }
    );

    if (!updatedUser) {
        const error = new Error('Concurrent transaction conflict. Insufficient credits.');
        error.statusCode = 402;
        throw error;
    }

    return {
        success: true,
        deducted: cost,
        remainingCredits: updatedUser.credits
    };
};

/**
 * Idempotent Razorpay Webhook Handler
 */
export const processWebhook = async (rawBody, signature) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        if (expectedSignature !== signature) {
            const error = new Error('Invalid webhook signature');
            error.statusCode = 400;
            throw error;
        }
    }

    const event = JSON.parse(rawBody.toString());

    // Handle payment.captured event
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;
        const paymentId = payment.id;

        const transaction = await Transaction.findOne({ orderId });
        if (!transaction) {
            return { received: true, message: 'Transaction not found for order' };
        }

        // Idempotency: if already processed, ignore
        if (transaction.status === 'captured') {
            return { received: true, message: 'Already processed' };
        }

        // Apply credits atomically
        const pack = CREDIT_PACKS[transaction.packId] || CREDIT_PACKS.pack_100;
        await User.findOneAndUpdate(
            { $or: [{ firebaseUid: transaction.userId }, { _id: transaction.userId.match(/^[0-9a-fA-F]{24}$/) ? transaction.userId : null }] },
            { $inc: { credits: transaction.creditsAdded || pack.credits } }
        );

        transaction.paymentId = paymentId;
        transaction.status = 'captured';
        await transaction.save();

        return { received: true, status: 'captured' };
    }

    return { received: true, event: event.event };
};
