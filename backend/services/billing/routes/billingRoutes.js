import express from 'express';
import {
    handleGetPacks,
    handleCreateOrder,
    handleVerifyPayment,
    handleDeductCredits,
    handleGetTransactions,
    handleWebhook
} from '../controllers/billingController.js';

const router = express.Router();

router.get('/packs', handleGetPacks);
router.post('/order', handleCreateOrder);
router.post('/create-order', handleCreateOrder); // backward compatibility alias
router.post('/verify', handleVerifyPayment);
router.post('/deduct', handleDeductCredits);
router.get('/transactions', handleGetTransactions);
router.post('/webhook', handleWebhook);

export default router;

