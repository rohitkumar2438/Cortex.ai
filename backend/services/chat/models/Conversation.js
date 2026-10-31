import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: [true, 'userId is required'],
            index: true
        },
        title: {
            type: String,
            default: 'New Chat',
            trim: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Helpful virtual getter for conversation id
conversationSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
export default Conversation;

