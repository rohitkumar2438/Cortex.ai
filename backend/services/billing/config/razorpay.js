import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

let razorpayInstance = null;

export const getRazorpay = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const isMock = !keyId || !keySecret || keyId.includes('dummy') || keyId.includes('your_');

    if (isMock) {
        return {
            isMock: true,
            key_id: 'rzp_test_mock_cortex',
            orders: {
                create: async (options) => ({
                    id: `order_mock_${Date.now()}`,
                    amount: options.amount,
                    currency: options.currency || 'INR',
                    receipt: options.receipt,
                    status: 'created'
                })
            }
        };
    }

    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
        razorpayInstance.isMock = false;
    }

    return razorpayInstance;
};

export default getRazorpay;

