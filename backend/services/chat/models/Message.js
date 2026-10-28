import mongoose from 'mongoose';

const artifactSchema = new mongoose.Schema(
    {
        files: [
            {
                name: { type: String, default: '' },
                content: { type: String, default: '' },
                language: { type: String, default: '' }
            }
        ],
        language: { type: String, default: '' },
        preview: { type: String, default: '' }
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: [true, 'conversationId is required'],
            index: true
        },
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: [true, 'role must be user or assistant']
        },
        content: {
            type: String,
            required: [true, 'content is required']
        },
        agent: {
            type: String,
            default: 'chat'
        },
        // Persistent array of image links (persists across reloads)
        images: {
            type: [String],
            default: []
        },
        // Generated file download URL (PDF, PPT, or Image)
        url: {
            type: String,
            default: null
        },
        // Optional structured artifact for coding / preview
        artifact: {
            type: artifactSchema,
            default: null
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

messageSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

const Message = mongoose.model('Message', messageSchema);
export default Message;

