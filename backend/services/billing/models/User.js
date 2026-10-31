import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        email: {
            type: String,
            required: true
        },
        name: {
            type: String,
            default: ''
        },
        avatar: {
            type: String,
            default: ''
        },
        credits: {
            type: Number,
            default: 100
        },
        plan: {
            type: String,
            enum: ['Free', 'Starter', 'Pro', 'Enterprise'],
            default: 'Free'
        }
    },
    {
        timestamps: true,
        collection: 'users',
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

userSchema.virtual('uid').get(function () {
    return this.firebaseUid;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
