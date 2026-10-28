import crypto from 'crypto';
import User from '../models/User.js';
import { auth as adminAuth } from '../config/firebase-admin.js';
import { setSession, getSession, deleteSession } from '../../../shared/redisClient.js';
import { INITIAL_USER_CREDITS, SESSION_TTL_SECONDS } from '../../../shared/constants.js';

export const verifyAndLogin = async (idToken) => {
    if (!idToken) {
        const error = new Error('No Firebase ID token provided');
        error.statusCode = 400;
        throw error;
    }

    // Verify token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    if (!email) {
        const error = new Error('Firebase token does not contain an email address');
        error.statusCode = 400;
        throw error;
    }

    // Find or create user in MongoDB
    let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });

    if (!user) {
        user = new User({
            firebaseUid: uid,
            email,
            name: name || email.split('@')[0],
            avatar: picture || '',
            credits: INITIAL_USER_CREDITS,
            plan: 'Free'
        });
        await user.save();
    } else {
        // Keep profile info updated if changed
        let updated = false;
        if (!user.firebaseUid) {
            user.firebaseUid = uid;
            updated = true;
        }
        if (name && user.name !== name) {
            user.name = name;
            updated = true;
        }
        if (picture && user.avatar !== picture) {
            user.avatar = picture;
            updated = true;
        }
        if (updated) {
            await user.save();
        }
    }

    // Generate session ID and store in Redis
    const sessionId = crypto.randomUUID();
    const sessionPayload = {
        userId: user._id.toString(),
        firebaseUid: user.firebaseUid,
        uid: user.firebaseUid,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        credits: user.credits,
        plan: user.plan
    };

    await setSession(sessionId, sessionPayload, SESSION_TTL_SECONDS);

    return { user, sessionId };
};

export const getUserProfile = async (identifier) => {
    if (!identifier) {
        const error = new Error('Not authenticated');
        error.statusCode = 401;
        throw error;
    }

    const user = await User.findOne({
        $or: [
            { firebaseUid: identifier },
            { _id: identifier.match(/^[0-9a-fA-F]{24}$/) ? identifier : null },
            { email: identifier }
        ].filter(Boolean)
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return user;
};

export const logoutSession = async (sessionId) => {
    if (sessionId) {
        await deleteSession(sessionId);
    }
};

export const resolveSession = async (sessionId) => {
    if (!sessionId) return null;
    return await getSession(sessionId);
};
