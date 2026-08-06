import { Notification } from '../models/NotificationModel.js';
import { User } from '../models/UserModel.js';

/**
 * Creates and persists a notification for a specific user and emits a real-time socket event
 */
export const createNotification = async (io, { userId, title, message, type = 'info', link = '' }) => {
    try {
        if (!userId) return null;

        const notif = new Notification({
            user: userId,
            title,
            message,
            type,
            link
        });

        await notif.save();

        if (io) {
            io.to(`user:${userId}`).emit('receive-user-notification', {
                id: notif._id.toString(),
                title: notif.title,
                message: notif.message,
                type: notif.type,
                link: notif.link,
                read: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: notif.createdAt
            });
        }

        return notif;
    } catch (err) {
        console.error("Error creating user notification:", err);
        return null;
    }
};

/**
 * Parses text for @mentions (e.g. @john, @user@example.com) and notifies mentioned users
 */
export const parseAndNotifyMentions = async (io, { text, senderUser, contextTitle, link, type = 'mention' }) => {
    try {
        if (!text || typeof text !== 'string') return;

        // Match @mentions: @email or @name
        const mentionMatches = text.match(/@([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)/g);
        if (!mentionMatches || mentionMatches.length === 0) return;

        const senderIdStr = senderUser?.id || senderUser?._id?.toString();
        const senderName = senderUser?.name || senderUser?.email || 'Someone';

        const cleanedHandles = mentionMatches.map(m => m.substring(1).toLowerCase());

        // Find users matching email or name (case-insensitive)
        const matchedUsers = await User.find({
            $or: [
                { email: { $in: cleanedHandles } },
                { name: { $in: cleanedHandles.map(h => new RegExp('^' + h, 'i')) } }
            ]
        });

        for (const user of matchedUsers) {
            // Do not notify sender if they mentioned themselves
            if (user._id.toString() === senderIdStr) continue;

            const previewText = text.length > 60 ? text.substring(0, 60) + '...' : text;
            await createNotification(io, {
                userId: user._id,
                title: `💬 Mentioned in ${contextTitle}`,
                message: `${senderName} mentioned you: "${previewText}"`,
                type: 'mention',
                link
            });
        }
    } catch (err) {
        console.error("Error processing mentions:", err);
    }
};
