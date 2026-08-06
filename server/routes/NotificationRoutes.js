import express from 'express';
import { Notification } from '../models/NotificationModel.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get authenticated user's notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, read: false },
            { $set: { read: true } }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error("Error marking notifications read:", error);
        res.status(500).json({ message: 'Error updating notifications' });
    }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: { read: true } },
            { new: true }
        );

        if (!notif) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json(notif);
    } catch (error) {
        console.error("Error marking notification read:", error);
        res.status(500).json({ message: 'Error updating notification' });
    }
});

// Clear all notifications for user
router.delete('/clear', authenticateToken, async (req, res) => {
    try {
        await Notification.deleteMany({ user: req.user.id });
        res.json({ message: 'Notifications cleared successfully' });
    } catch (error) {
        console.error("Error clearing notifications:", error);
        res.status(500).json({ message: 'Error clearing notifications' });
    }
});

export default router;
