import { verifyAndLogin, getUserProfile, logoutSession, resolveSession } from '../services/authService.js';
import { COOKIE_NAME, SESSION_TTL_SECONDS } from '../../../shared/constants.js';

export const login = async (req, res, next) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }

        const { user, sessionId } = await verifyAndLogin(idToken);

        const isProd = process.env.NODE_ENV === 'production';
        res.cookie(COOKIE_NAME, sessionId, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: SESSION_TTL_SECONDS * 1000
        });

        return res.status(200).json({
            message: 'Login successful',
            user,
            sessionId
        });
    } catch (error) {
        next(error);
    }
};

export const me = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.[COOKIE_NAME] || req.headers['x-session-id'];
        const forwardedUserId = req.headers['x-user-id'];

        let targetId = forwardedUserId;

        if (!targetId && sessionId) {
            const session = await resolveSession(sessionId);
            if (session) {
                targetId = session.userId || session.firebaseUid || session.uid;
            }
        }

        if (!targetId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await getUserProfile(targetId);
        return res.status(200).json({ user });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.[COOKIE_NAME] || req.headers['x-session-id'];
        if (sessionId) {
            await logoutSession(sessionId);
        }

        res.clearCookie(COOKIE_NAME);
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};
