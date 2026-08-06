// server/database/redis.js
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let isRedisConnected = false;

// Configured for local Redis server instance running on 127.0.0.1:6379
const LOCAL_REDIS_URL = process.env.REDIS_LOCAL_URL || 'redis://127.0.0.1:6379';

const redisClient = createClient({
    url: LOCAL_REDIS_URL,
    socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
            if (retries > 3) {
                console.log('ℹ Local Redis unavailable after retries. In-memory fallback active.');
                return new Error('Local Redis connection failed');
            }
            return Math.min(retries * 500, 1500);
        }
    }
});

redisClient.on('error', (err) => {
    if (isRedisConnected) {
        console.error('Local Redis Error:', err.message || err);
    }
    isRedisConnected = false;
});

redisClient.on('ready', () => {
    console.log(`Connected to Local Redis Server successfully on ${LOCAL_REDIS_URL}!`);
    isRedisConnected = true;
});

redisClient.on('end', () => {
    isRedisConnected = false;
});

// Asynchronously connect to local Redis instance without blocking server boot
redisClient.connect().catch((err) => {
    console.log(`ℹ Local Redis (${LOCAL_REDIS_URL}) not running. Operating in local in-memory mode.`);
    isRedisConnected = false;
});

export { isRedisConnected };
export default redisClient;

