import jwt from 'jsonwebtoken';
import { User } from '../models/UserModel.js';
import redisClient, { isRedisConnected } from '../database/redis.js';

export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Access token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const userId = decoded.user;
        const cacheKey = `user:${userId}`;

        // 1. Try to fetch user from Redis cache if connected
        if (isRedisConnected) {
            try {
                const cachedUser = await redisClient.get(cacheKey);
                if (cachedUser) {
                    req.user = JSON.parse(cachedUser);
                    return next();
                }
            } catch (err) {
                console.error('Redis session read error:', err.message || err);
            }
        }

        // 2. Cache miss or Redis offline -> Query MongoDB
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 3. Cache the user object in Redis if connected
        if (isRedisConnected) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(user), {
                    EX: 3600
                });
            } catch (err) {
                console.error('Redis session write error:', err.message || err);
            }
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(403).json({ message: 'Invalid or expired access token' });
    }
};
