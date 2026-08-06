import express from 'express';
import { User } from '../models/UserModel.js';
import { Workspace } from '../models/WorkspaceModel.js';
import { Meeting } from '../models/MeetingModel.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireSystemRole } from '../middleware/rbac.js';

const router = express.Router();

// Gate all admin routes to SUPER_ADMIN users
router.use(authenticateToken, requireSystemRole('SUPER_ADMIN'));

// Get system users list with global roles
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error("Admin fetch users error:", error);
        res.status(500).json({ message: 'Error fetching platform users' });
    }
});

// Update global system role for a user
router.put('/users/:userId/role', async (req, res) => {
    try {
        const { systemRole } = req.body;
        const validRoles = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'MEDIA_MANAGER', 'PLATFORM_USER'];

        if (!validRoles.includes(systemRole)) {
            return res.status(400).json({ message: 'Invalid system role' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { systemRole },
            { new: true, select: '-password' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User system role updated successfully', user });
    } catch (error) {
        console.error("Admin update role error:", error);
        res.status(500).json({ message: 'Error updating user system role' });
    }
});

// Get system analytics and platform health metrics
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalWorkspaces = await Workspace.countDocuments();
        const totalMeetings = await Meeting.countDocuments();
        const roleDistribution = await User.aggregate([
            { $group: { _id: "$systemRole", count: { $sum: 1 } } }
        ]);

        res.json({
            totalUsers,
            totalWorkspaces,
            totalMeetings,
            roleDistribution
        });
    } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ message: 'Error fetching admin metrics' });
    }
});

export default router;
