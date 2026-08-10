// server/database/redis.js
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let isRedisConnected = false;

// Resolve Redis URL based on environment configuration:
// 1. Full connection URI (REDIS_URL) - Managed Cloud Redis (Upstash, Redis Cloud, AWS ElastiCache, Render, etc.)
// 2. HOST + PORT (+ optional PASSWORD) - Docker Compose / Kubernetes ConfigMaps
// 3. REDIS_LOCAL_URL or local default 127.0.0.1:6379
function getRedisUrl() {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }
    if (process.env.REDIS_HOST) {
        const host = process.env.REDIS_HOST;
        const port = process.env.REDIS_PORT || 6379;
        const password = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
        return `redis://${password}${host}:${port}`;
    }
    return process.env.REDIS_LOCAL_URL || 'redis://127.0.0.1:6379';
}

const REDIS_URL = getRedisUrl();
const isProduction = process.env.NODE_ENV === 'production';

// Safely sanitize URL for logging (strip out password if present)
const sanitizedUrl = REDIS_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

const redisClient = createClient({
    url: REDIS_URL,
    socket: {
        connectTimeout: 10000,
        tls: REDIS_URL.startsWith('rediss://') ? true : undefined,
        reconnectStrategy: (retries) => {
            if (isProduction) {
                // Production: exponential backoff retries up to 30s
                return Math.min(retries * 500, 30000);
            }
            if (retries > 3) {
                console.log('ℹ Redis unavailable. In-memory fallback active.');
                return new Error('Redis connection failed');
            }
            return Math.min(retries * 500, 1500);
        }
    }
});

redisClient.on('error', (err) => {
    if (isRedisConnected) {
        console.error('Redis Error:', err.message || err);
    }
    isRedisConnected = false;
});

redisClient.on('ready', () => {
    console.log(`Connected to Redis Server successfully on ${sanitizedUrl}!`);
    isRedisConnected = true;
});

const pubClient = redisClient;
const subClient = pubClient.duplicate();

subClient.on('error', (err) => {
    // Silent subClient error handler
});

redisClient.connect().then(() => {
    return subClient.connect();
}).catch((err) => {
    console.log(`ℹ Redis (${sanitizedUrl}) not running. Operating in in-memory fallback mode.`);
    isRedisConnected = false;
});

export { isRedisConnected, pubClient, subClient };
export default redisClient;


