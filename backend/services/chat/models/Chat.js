import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String, // e.g., 'chat', 'code', 'pdf', 'ppt', 'image'
        default: 'chat'
    },
    url: {
        type: String // To store generated file or image URL
    },
    artifacts: {
        type: mongoose.Schema.Types.Mixed, // Stores structured artifacts e.g. { files: [{ name, content }] }
        default: null
    },
    sources: {
        type: mongoose.Schema.Types.Mixed, // Stores RAG retrieval sources and citations
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    userId: {
        type: String, // From Firebase UID
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    messages: [messageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
chatSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
export default Chat;
