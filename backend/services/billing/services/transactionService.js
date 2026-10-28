import Transaction from '../models/Transaction.js';

export const listUserTransactions = async (userId) => {
    return await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .lean();
};

export default listUserTransactions;

