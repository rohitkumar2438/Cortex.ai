import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

let app;

const initFirebase = () => {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    // 1. Check if raw JSON string is provided in env
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            return initializeApp({
                credential: cert(credentials)
            });
        } catch (err) {
            console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT env var:', err.message);
        }
    }

    // 2. Check serviceAccountKey.json path
    const keyPath = process.env.FIREBASE_KEY_PATH || path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (existsSync(keyPath)) {
        try {
            const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
            return initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (err) {
            console.warn('⚠️ Error reading serviceAccountKey.json:', err.message);
        }
    }

    // 3. Fallback dummy app for local test environments without crashing startup
    console.warn('⚠️ Firebase Admin: No valid credentials found. Token verification will operate in fallback/dev mode.');
    return initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'cortex-ai-dev'
    });
};

app = initFirebase();
export const auth = getAuth(app);
export default app;
