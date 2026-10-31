import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: [true, 'userId is required'],
            index: true
        },
        orderId: {
            type: String,
            required: [true, 'orderId is required'],
            unique: true,
            index: true
        },
        paymentId: {
            type: String,
            default: null,
            sparse: true,
            index: true
        },
        packId: {
            type: String,
            enum: ['pack_100', 'pack_500', 'pack_1000', 'custom'],
            default: 'pack_100'
        },
        creditsAdded: {
            type: Number,
            required: [true, 'creditsAdded is required']
        },
        amount: {
            type: Number,
            required: [true, 'amount is required']
        },
        currency: {
            type: String,
            default: 'INR'
        },
        status: {
            type: String,
            enum: ['created', 'captured', 'failed'],
            default: 'created',
            index: true
        },
        signature: {
            type: String,
            default: null
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

transactionSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;

