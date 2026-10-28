import { createClient } from 'redis';

let redisClient;

const connectRedis = async () => {
    if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://test_url') {
        console.warn('⚠️ No real REDIS_URL provided. Running Chat Service without Redis caching.');
        return null; // Return null so the app knows caching is disabled
    }

    try {
        redisClient = createClient({
            url: process.env.REDIS_URL
        });

        redisClient.on('error', (err) => console.error('Redis Client Error', err));

        await redisClient.connect();
        console.log('Redis connected successfully for Chat Service Cache');
        return redisClient;
    } catch (error) {
        console.error('Redis connection failed:', error);
        return null;
    }
};

export { connectRedis, redisClient };
