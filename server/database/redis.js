// server/database/redis.js
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let isRedisConnected = false;

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                console.log('Redis: Maximum reconnection attempts reached. Caching is disabled.');
                return new Error('Redis connection failed');
            }
            return Math.min(retries * 500, 2000);
        }
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err.message || err);
    isRedisConnected = false;
});

redisClient.on('ready', () => {
    console.log('Connected to Redis Successfully!');
    isRedisConnected = true;
});

redisClient.on('end', () => {
    isRedisConnected = false;
});

// Connect to Redis on boot asynchronously (does not block server startup)
redisClient.connect().catch((err) => {
    console.error('Failed to establish initial Redis connection:', err.message);
    isRedisConnected = false;
});

export { isRedisConnected };
export default redisClient;
