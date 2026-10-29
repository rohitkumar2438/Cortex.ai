// In-memory fallback store for development without Redis server
const memoryStore = new Map();

let client = null;
let isConnected = false;

export const initRedis = async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl || redisUrl.includes('dummy') || redisUrl.includes('test_url')) {
        console.warn('⚠️ Shared Redis: REDIS_URL not configured. Operating in in-memory session mode.');
        return null;
    }

    try {
        const { createClient } = await import('redis');
        if (!client) {
            client = createClient({ url: redisUrl });
            client.on('error', (err) => {
                console.warn('⚠️ Shared Redis Client error (in-memory fallback active):', err.message);
                isConnected = false;
            });
            client.on('connect', () => {
                isConnected = true;
                console.log('✅ Shared Redis connected successfully.');
            });
            await client.connect();
        }
        return client;
    } catch (err) {
        console.warn('⚠️ Redis package not loaded, using in-memory session store:', err.message);
        isConnected = false;
        return null;
    }
};

export const setSession = async (sessionId, data, ttlSeconds = 7 * 24 * 60 * 60) => {
    const payload = JSON.stringify(data);
    if (isConnected && client) {
        try {
            await client.setEx(`session:${sessionId}`, ttlSeconds, payload);
            return;
        } catch (e) {
            // fallback
        }
    }
    // Fallback
    memoryStore.set(`session:${sessionId}`, {
        payload,
        expiresAt: Date.now() + ttlSeconds * 1000
    });
};

export const getSession = async (sessionId) => {
    if (!sessionId) return null;

    if (isConnected && client) {
        try {
            const data = await client.get(`session:${sessionId}`);
            if (data) return JSON.parse(data);
        } catch (e) {
            // fallback
        }
    }

    // Fallback check
    const entry = memoryStore.get(`session:${sessionId}`);
    if (entry) {
        if (Date.now() > entry.expiresAt) {
            memoryStore.delete(`session:${sessionId}`);
            return null;
        }
        return JSON.parse(entry.payload);
    }
    return null;
};

export const deleteSession = async (sessionId) => {
    if (!sessionId) return;
    if (isConnected && client) {
        try {
            await client.del(`session:${sessionId}`);
        } catch (e) {
            // fallback
        }
    }
    memoryStore.delete(`session:${sessionId}`);
};

/**
 * Generic Redis key-value cache setter with TTL (default 24 hours = 86400s)
 */
export const setCache = async (key, data, ttlSeconds = 86400) => {
    if (!key) return false;
    const payload = JSON.stringify(data);
    if (isConnected && client) {
        try {
            await client.setEx(key, ttlSeconds, payload);
            return true;
        } catch (e) {
            console.warn(`⚠️ Redis setCache failed for key ${key}:`, e.message);
        }
    }
    // In-memory fallback
    memoryStore.set(key, {
        payload,
        expiresAt: Date.now() + ttlSeconds * 1000
    });
    return true;
};

/**
 * Generic Redis key-value cache getter
 */
export const getCache = async (key) => {
    if (!key) return null;

    if (isConnected && client) {
        try {
            const data = await client.get(key);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn(`⚠️ Redis getCache failed for key ${key}:`, e.message);
        }
    }

    // In-memory fallback check
    const entry = memoryStore.get(key);
    if (entry) {
        if (Date.now() > entry.expiresAt) {
            memoryStore.delete(key);
            return null;
        }
        return JSON.parse(entry.payload);
    }
    return null;
};

export const getRawClient = () => client;
