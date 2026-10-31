import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        avatar: {
            type: String,
            default: ''
        },
        credits: {
            type: Number,
            default: 100 // Default initial credits
        },
        plan: {
            type: String,
            enum: ['Free', 'Starter', 'Pro'],
            default: 'Free'
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtuals for backward compatibility with existing components
userSchema.virtual('uid').get(function () {
    return this.firebaseUid;
});
userSchema.virtual('picture').get(function () {
    return this.avatar;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
