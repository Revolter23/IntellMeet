import express from 'express';
import multer from 'multer';
import { Meeting } from '../models/MeetingModel.js';
import { authenticateToken } from '../middleware/auth.js';
import redisClient, { isRedisConnected } from '../database/redis.js';
import { uploadRecordingToS3, getS3PresignedUploadUrl } from '../services/s3Service.js';
import { autoProcessMeetingAI } from '../services/aiService.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 500 * 1024 * 1024 } });

const router = express.Router();

// Helper to generate a Google-Meet-style meeting code (e.g., abc-defg-hij)
const generateMeetingCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const part = (length) => Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part(3)}-${part(4)}-${part(3)}`;
};

// Helper to ensure generated meeting code is unique in the database
const getUniqueMeetingCode = async () => {
    let code;
    let exists = true;
    while (exists) {
        code = generateMeetingCode();
        const existingMeeting = await Meeting.findOne({ meetingCode: code });
        if (!existingMeeting) {
            exists = false;
        }
    }
    return code;
};

/**
 * @route   POST /meetings
 * @desc    Create a new virtual meeting
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, description, startTime, passcode, isPrivate } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }

        if (!startTime) {
            return res.status(400).json({ message: 'Start time is required' });
        }

        const meetingCode = await getUniqueMeetingCode();

        const newMeeting = new Meeting({
            title,
            description,
            host: req.user.id,
            meetingCode,
            passcode,
            isPrivate: isPrivate || false,
            startTime,
            status: 'scheduled',
            participants: [{
                user: req.user.id,
                role: 'host',
                joinedAt: new Date()
            }]
        });

        await newMeeting.save();

        console.log(`New Meeting Created: ${newMeeting.title} (${newMeeting.meetingCode}) by Host ${req.user.email}`);

        res.status(201).json({
            message: 'Meeting created successfully',
            meeting: newMeeting
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ message: 'Internal server error creating meeting' });
    }
});

/**
 * @route   GET /meetings
 * @desc    Get all meetings where the authenticated user is the host or a participant
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch meetings where the user is either the host or one of the participants
        const meetings = await Meeting.find({
            $or: [
                { host: userId },
                { 'participants.user': userId }
            ]
        })
        .populate('host', 'name email avatar')
        .populate('participants.user', 'name email avatar')
        .sort({ startTime: -1 });

        res.json({ meetings });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ message: 'Internal server error fetching meetings' });
    }
});

/**
 * @route   GET /meetings/:meetingCode
 * @desc    Get meeting details by its unique room/meeting code
 * @access  Private
 */
router.get('/:meetingCode', authenticateToken, async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const userId = req.user.id;
        const cacheKey = `meeting:${meetingCode}`;

        let meeting;

        // 1. Try to fetch from Redis if connected
        if (isRedisConnected) {
            try {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    meeting = JSON.parse(cachedData);
                }
            } catch (err) {
                console.error('Redis meeting read error:', err.message || err);
            }
        }

        if (!meeting) {
            // Cache miss or Redis offline -> Query MongoDB (populated)
            meeting = await Meeting.findOne({ meetingCode })
                .populate('host', 'name email avatar')
                .populate('participants.user', 'name email avatar');

            if (meeting && isRedisConnected) {
                try {
                    // Cache populated meeting for 10 minutes (600 seconds)
                    await redisClient.set(cacheKey, JSON.stringify(meeting), { EX: 600 });
                } catch (err) {
                    console.error('Redis meeting write error:', err.message || err);
                }
            }
        }

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        // Host check compatibility (whether host field is populated or an ID string)
        const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();

        // If the meeting is private, check that the user is authorized to access it
        if (meeting.isPrivate && hostId !== userId) {
            const isParticipant = meeting.participants.some(p => {
                const pUserId = p.user._id ? p.user._id.toString() : p.user.toString();
                return pUserId === userId;
            });
            if (!isParticipant) {
                return res.status(403).json({ message: 'Access denied: This is a private meeting room' });
            }
        }

        // Add user to participants if they are not already in the participant log
        const hasJoined = meeting.participants.some(p => {
            const pUserId = p.user._id ? p.user._id.toString() : p.user.toString();
            return pUserId === userId;
        });

        if (!hasJoined || meeting.status === 'scheduled') {
            const dbMeeting = await Meeting.findOne({ meetingCode });
            if (!dbMeeting) {
                return res.status(404).json({ message: 'Meeting not found in database' });
            }

            if (!hasJoined) {
                dbMeeting.participants.push({
                    user: userId,
                    role: dbMeeting.host.toString() === userId ? 'host' : 'attendee',
                    joinedAt: new Date()
                });
            }

            if (dbMeeting.status === 'scheduled') {
                dbMeeting.status = 'active';
            }

            await dbMeeting.save();

            // Refresh cache with populated meeting
            const updatedMeeting = await Meeting.findById(dbMeeting._id)
                .populate('host', 'name email avatar')
                .populate('participants.user', 'name email avatar');

            if (isRedisConnected) {
                try {
                    await redisClient.set(cacheKey, JSON.stringify(updatedMeeting), { EX: 600 });
                } catch (err) {
                    console.error('Redis meeting write error:', err.message || err);
                }
            }
            meeting = updatedMeeting;
        }

        res.json({ meeting });
    } catch (error) {
        console.error('Error fetching/joining meeting details:', error);
        res.status(500).json({ message: 'Internal server error fetching meeting details' });
    }
});

/**
 * @route   PUT /meetings/:id
 * @desc    Update meeting details (Only host can update)
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startTime, endTime, status, passcode, isPrivate } = req.body;
        const userId = req.user.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        // Ensure request is made by the host
        if (meeting.host.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: Only the host can update this meeting' });
        }

        // Update fields if provided
        if (title !== undefined) meeting.title = title;
        if (description !== undefined) meeting.description = description;
        if (startTime !== undefined) meeting.startTime = startTime;
        if (endTime !== undefined) meeting.endTime = endTime;
        if (status !== undefined) meeting.status = status;
        if (passcode !== undefined) meeting.passcode = passcode;
        if (isPrivate !== undefined) meeting.isPrivate = isPrivate;

        await meeting.save();

        // Invalidate Redis meeting details cache
        if (isRedisConnected) {
            try {
                await redisClient.del(`meeting:${meeting.meetingCode}`);
            } catch (err) {
                console.error("Redis meeting delete error:", err.message || err);
            }
        }

        console.log(`Meeting Updated: ${meeting.title} (${meeting.meetingCode})`);

        res.json({
            message: 'Meeting updated successfully',
            meeting
        });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ message: 'Internal server error updating meeting' });
    }
});

/**
 * @route   DELETE /meetings/:id
 * @desc    Delete/Cancel a meeting (Only host can delete)
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        // Ensure request is made by the host
        if (meeting.host.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: Only the host can delete this meeting' });
        }

        await Meeting.findByIdAndDelete(id);

        // Invalidate Redis meeting details cache
        if (isRedisConnected) {
            try {
                await redisClient.del(`meeting:${meeting.meetingCode}`);
            } catch (err) {
                console.error("Redis meeting delete error:", err.message || err);
            }
        }

        console.log(`Meeting Deleted: ${meeting.title} (${meeting.meetingCode})`);

        res.json({ message: 'Meeting deleted successfully' });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ message: 'Internal server error deleting meeting' });
    }
});

/**
 * @route   GET /meetings/:meetingCode/s3-presigned-url
 * @desc    Generate a presigned S3 upload URL for direct client-side recording upload
 * @access  Private
 */
router.get('/:meetingCode/s3-presigned-url', authenticateToken, async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const mimeType = req.query.mimeType || 'video/webm';

        const presignedData = await getS3PresignedUploadUrl(meetingCode, mimeType);
        res.status(200).json(presignedData);
    } catch (error) {
        console.error('Error generating S3 presigned URL:', error);
        res.status(500).json({ message: error.message || 'Internal server error generating S3 upload URL' });
    }
});

/**
 * @route   POST /meetings/:meetingCode/recording
 * @desc    Save uploaded recording S3 URL & trigger AI pipeline
 * @access  Private
 */
router.post('/:meetingCode/recording', authenticateToken, async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { recordingUrl } = req.body;

        if (!recordingUrl) {
            return res.status(400).json({ message: 'No recording URL provided' });
        }

        // Update meeting document in MongoDB
        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        meeting.recordingUrl = recordingUrl;
        await meeting.save();

        // Automatically trigger AI processing pipeline in background
        autoProcessMeetingAI(meetingCode, recordingUrl).catch(err => {
            console.error("Background AI processing failed:", err);
        });

        res.status(200).json({
            message: 'Recording saved to Amazon S3 successfully. AI processing started.',
            recordingUrl
        });
    } catch (error) {
        console.error('Error saving recording URL:', error);
        res.status(500).json({ message: error.message || 'Internal server error saving recording URL' });
    }
});

export default router;
