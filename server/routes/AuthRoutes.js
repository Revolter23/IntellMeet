import { User } from '../models/UserModel.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const generateAccessToken = (user) => {
    return jwt.sign({ user: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
    console.log("Refresh Token Generated");
    return jwt.sign({ user: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (user) {
            return res.status(409).json({
                message: 'User already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user (defaulting name from email prefix if not supplied)
        const name = email.split('@')[0];
        const newUser = new User({
            email,
            password: hashedPassword,
            name
        });

        await newUser.save();

        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);

        setRefreshTokenCookie(res, refreshToken);

        console.log("New User Signed Up: ", newUser.email);
        res.status(201).json({
            accessToken,
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                avatar: newUser.avatar
            }
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const passwordMatched = await bcrypt.compare(password, user.password);

        if (!passwordMatched) {
            return res.status(401).json({
                message: 'Invalid Credentials'
            });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        setRefreshTokenCookie(res, refreshToken);

        res.json({
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.user);

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const accessToken = generateAccessToken(user);

        // Optionally rotate refresh token if desired, but not strictly necessary for basic implementation.
        // We'll keep the same refresh token or issue a fresh one. Let's issue a fresh one to slide the window.
        const newRefreshToken = generateRefreshToken(user);
        setRefreshTokenCookie(res, newRefreshToken);

        res.json({
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
});

// Get Cloudinary upload signature
router.get('/cloudinary-signature', authenticateToken, (req, res) => {
    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return res.status(500).json({
                message: 'Cloudinary configuration is missing on the server. Please check your environment variables.'
            });
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = 'intellmeet_avatars';

        // Generate signature: sort alphabetically, join key=val with &, and append secret
        const paramsToSign = {
            timestamp: timestamp,
            folder: folder
        };

        const sortedKeys = Object.keys(paramsToSign).sort();
        const parameterString = sortedKeys
            .map(key => `${key}=${paramsToSign[key]}`)
            .join('&') + apiSecret;

        const signature = crypto.createHash('sha1').update(parameterString).digest('hex');

        res.json({
            signature,
            timestamp,
            folder,
            cloudName,
            apiKey
        });
    } catch (error) {
        console.error("Cloudinary signature error:", error);
        res.status(500).json({ message: 'Internal server error generating signature' });
    }
});

// Update user profile details
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, avatar } = req.body;
        const user = req.user;

        if (name !== undefined) user.name = name;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        console.log("Profile Updated: ", user.avatar);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ message: 'Internal server error updating profile' });
    }
});

export default router;