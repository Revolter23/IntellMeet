import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import main from './database/mongodb.js'; // Ensure database starts up as well
import redisClient, { isRedisConnected } from './database/redis.js';

import AuthRoutes from './routes/AuthRoutes.js';
import MeetingRoutes from './routes/MeetingRoutes.js';
import AdminRoutes from './routes/AdminRoutes.js';
import WorkspaceRoutes from './routes/WorkspaceRoutes.js';
import BoardRoutes from './routes/BoardRoutes.js';
import NotificationRoutes from './routes/NotificationRoutes.js';
import { parseAndNotifyMentions } from './services/notificationService.js';

const globalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.'
});

const app = express();
const port = 3000;

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));
app.use(globalLimiter);
app.use(cookieParser());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

main();

app.use("/auth", AuthRoutes);
app.use("/meetings", MeetingRoutes);
app.use("/api/admin", AdminRoutes);
app.use("/api/workspaces", WorkspaceRoutes);
app.use("/api/boards", BoardRoutes);
app.use("/api/notifications", NotificationRoutes);

// 1. Wrap the express application in an HTTP server
const httpServer = createServer(app);

// 2. Initialize Socket.io with optimized real-time configurations
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    },
    // Heartbeat tuning for rapid detection of dropped WebRTC peers
    pingInterval: 10000, // Send ping every 10s
    pingTimeout: 5000,   // Disconnect if no pong received within 5s
    // Prioritize WebSocket transport for ultra-low latency signaling
    transports: ['websocket', 'polling'],
    // Allow up to 10 MB payload buffer size
    maxHttpBufferSize: 1e7,
    // Enable connection state recovery for brief client disconnections
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
    }
});

// Expose io instance to Express request handlers
app.set('io', io);

// Handshake middleware to attach user metadata if provided in auth payload
io.use((socket, next) => {
    const authUser = socket.handshake.auth?.user;
    if (authUser) {
        socket.data.user = authUser;
    }
    next();
});


// Fallback in-memory mappings if Redis is down
const localSocketToRoom = {};
const localSocketToUser = {};

// 3. Set up event handlers for socket connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Personal user notification room subscription
    socket.on('join-user-room', (userId) => {
        if (userId) {
            socket.join(`user:${userId}`);
            console.log(`Socket ${socket.id} joined personal user room: user:${userId}`);
        }
    });

    // Board room subscription
    socket.on('join:board', (boardId) => {
        if (boardId) {
            socket.join(`board:${boardId}`);
            console.log(`Socket ${socket.id} joined board room: board:${boardId}`);
        }
    });

    socket.on('leave:board', (boardId) => {
        if (boardId) {
            socket.leave(`board:${boardId}`);
        }
    });

    // Join Room handler: adds user to the room, notifies existing peers, and returns list of current peers
    socket.on('join-room', async ({ meetingCode, user }) => {
        if (!meetingCode || !user) return;
        
        socket.join(meetingCode);
        if (isRedisConnected) {
            try {
                await redisClient.hSet('socketToRoom', socket.id, meetingCode);
                await redisClient.hSet('socketToUser', socket.id, JSON.stringify(user));
            } catch (err) {
                console.error("Redis socket set error:", err);
                localSocketToRoom[socket.id] = meetingCode;
                localSocketToUser[socket.id] = user;
            }
        } else {
            localSocketToRoom[socket.id] = meetingCode;
            localSocketToUser[socket.id] = user;
        }

        console.log(`User ${user.email} (${socket.id}) joined meeting: ${meetingCode}`);

        // Broadcast to other participants in the room that a new user has joined
        socket.to(meetingCode).emit('user-joined', {
            socketId: socket.id,
            user: user
        });

        // Broadcast real-time notification to room participants
        socket.to(meetingCode).emit('receive-notification', {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            type: 'user-joined',
            title: 'Participant Joined',
            message: `${user.name || user.email} joined the meeting`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            user: user
        });


        // Collect other active users in this room
        const clients = io.sockets.adapter.rooms.get(meetingCode);
        const usersInRoom = [];
        if (clients) {
            for (const clientId of clients) {
                if (clientId !== socket.id) {
                    if (isRedisConnected) {
                        try {
                            const clientUserData = await redisClient.hGet('socketToUser', clientId);
                            if (clientUserData) {
                                usersInRoom.push({
                                    socketId: clientId,
                                    user: JSON.parse(clientUserData)
                                });
                            } else if (localSocketToUser[clientId]) {
                                usersInRoom.push({
                                    socketId: clientId,
                                    user: localSocketToUser[clientId]
                                });
                            }
                        } catch (err) {
                            console.error("Redis socket get error:", err);
                            if (localSocketToUser[clientId]) {
                                usersInRoom.push({
                                    socketId: clientId,
                                    user: localSocketToUser[clientId]
                                });
                            }
                        }
                    } else {
                        if (localSocketToUser[clientId]) {
                            usersInRoom.push({
                                socketId: clientId,
                                user: localSocketToUser[clientId]
                            });
                        }
                    }
                }
            }
        }
        
        // Send list of all existing users to the joining client
        socket.emit('all-users', usersInRoom);
    });

    // WebRTC Offer: relay from caller to target socket
    socket.on('offer', async ({ to, offer }) => {
        let user = null;
        if (isRedisConnected) {
            try {
                const clientUserData = await redisClient.hGet('socketToUser', socket.id);
                user = clientUserData ? JSON.parse(clientUserData) : localSocketToUser[socket.id];
            } catch (err) {
                console.error("Redis socket get error in offer:", err);
                user = localSocketToUser[socket.id];
            }
        } else {
            user = localSocketToUser[socket.id];
        }

        io.to(to).emit('offer', {
            from: socket.id,
            offer: offer,
            user: user || null
        });
    });

    // WebRTC Answer: relay from callee to target socket
    socket.on('answer', ({ to, answer }) => {
        io.to(to).emit('answer', {
            from: socket.id,
            answer: answer
        });
    });

    // WebRTC ICE Candidate: relay candidate between peers
    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', {
            from: socket.id,
            candidate: candidate
        });
    });

    // Media State Toggle: relay camera/mic toggling events for UI indicators
    socket.on('toggle-media', async ({ isAudioMuted, isVideoMuted }) => {
        let meetingCode = null;
        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
            } catch (err) {
                console.error("Redis socket get error in toggle-media:", err);
                meetingCode = localSocketToRoom[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
        }

        if (meetingCode) {
            socket.to(meetingCode).emit('user-media-toggled', {
                socketId: socket.id,
                isAudioMuted,
                isVideoMuted
            });
        }
    });

    // In-Meeting Chat: Broadcast chat messages to all participants in the meeting room
    socket.on('send-message', async ({ text }) => {
        if (!text || !text.trim()) return;

        let meetingCode = null;
        let senderUser = null;

        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
                const userJson = await redisClient.hGet('socketToUser', socket.id);
                senderUser = userJson ? JSON.parse(userJson) : localSocketToUser[socket.id];
            } catch (err) {
                console.error("Redis socket get error in send-message:", err);
                meetingCode = localSocketToRoom[socket.id];
                senderUser = localSocketToUser[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
            senderUser = localSocketToUser[socket.id];
        }

        if (meetingCode && senderUser) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                senderSocketId: socket.id,
                senderName: senderUser.name || 'Participant',
                senderAvatar: senderUser.avatar,
                senderId: senderUser.id,
                text: text.trim(),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            // Broadcast message to everyone in the room (including sender)
            io.in(meetingCode).emit('receive-message', messageData);

            // Parse and notify @mentions in chat text
            parseAndNotifyMentions(io, {
                text: text.trim(),
                senderUser,
                contextTitle: `Meeting ${meetingCode}`,
                link: `/meetings/history/${meetingCode}`
            });
        }
    });

    // Custom notification event: Relay custom real-time notification to a meeting room
    socket.on('send-notification', async ({ meetingCode, type, title, message }) => {
        if (!meetingCode || !title || !message) return;

        const notificationPayload = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            type: type || 'info',
            title: title,
            message: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.to(meetingCode).emit('receive-notification', notificationPayload);
    });

    // Screen Share Toggle: relay screen sharing state to room participants
    socket.on('screen-share-toggled', async ({ isScreenSharing }) => {
        let meetingCode = null;
        let senderUser = null;

        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
                const userJson = await redisClient.hGet('socketToUser', socket.id);
                senderUser = userJson ? JSON.parse(userJson) : localSocketToUser[socket.id];
            } catch (err) {
                meetingCode = localSocketToRoom[socket.id];
                senderUser = localSocketToUser[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
            senderUser = localSocketToUser[socket.id];
        }

        if (meetingCode) {
            socket.to(meetingCode).emit('user-screen-toggled', {
                socketId: socket.id,
                isScreenSharing
            });

            // Broadcast real-time toast alert
            const userName = senderUser ? (senderUser.name || senderUser.email) : 'A participant';
            socket.to(meetingCode).emit('receive-notification', {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                type: 'info',
                title: isScreenSharing ? 'Screen Sharing Started' : 'Screen Sharing Stopped',
                message: isScreenSharing ? `${userName} started sharing their screen` : `${userName} stopped screen sharing`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    // Recording Toggle: relay recording status alert to meeting room
    socket.on('recording-toggled', async ({ isRecording }) => {
        let meetingCode = null;
        let senderUser = null;

        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
                const userJson = await redisClient.hGet('socketToUser', socket.id);
                senderUser = userJson ? JSON.parse(userJson) : localSocketToUser[socket.id];
            } catch (err) {
                meetingCode = localSocketToRoom[socket.id];
                senderUser = localSocketToUser[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
            senderUser = localSocketToUser[socket.id];
        }

        if (meetingCode) {
            const userName = senderUser ? (senderUser.name || senderUser.email) : 'A participant';
            socket.to(meetingCode).emit('receive-notification', {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                type: isRecording ? 'warning' : 'info',
                title: isRecording ? 'Meeting Recording Started' : 'Meeting Recording Stopped',
                message: isRecording ? `${userName} started recording this call` : `${userName} stopped recording`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    // Typing Indicators: Relay typing events to room participants
    socket.on('typing-start', async () => {
        let meetingCode = null;
        let senderUser = null;

        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
                const userJson = await redisClient.hGet('socketToUser', socket.id);
                senderUser = userJson ? JSON.parse(userJson) : localSocketToUser[socket.id];
            } catch (err) {
                meetingCode = localSocketToRoom[socket.id];
                senderUser = localSocketToUser[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
            senderUser = localSocketToUser[socket.id];
        }

        if (meetingCode && senderUser) {
            socket.to(meetingCode).emit('user-typing', {
                socketId: socket.id,
                userName: senderUser.name || 'Participant',
                isTyping: true
            });
        }
    });

    socket.on('typing-stop', async () => {
        let meetingCode = null;

        if (isRedisConnected) {
            try {
                meetingCode = await redisClient.hGet('socketToRoom', socket.id);
            } catch (err) {
                meetingCode = localSocketToRoom[socket.id];
            }
        } else {
            meetingCode = localSocketToRoom[socket.id];
        }

        if (meetingCode) {
            socket.to(meetingCode).emit('user-typing', {
                socketId: socket.id,
                isTyping: false
            });
        }
    });


    // Handle user disconnect

    socket.on('disconnect', async () => {
        let room = null;
        let user = null;

        if (isRedisConnected) {
            try {
                room = await redisClient.hGet('socketToRoom', socket.id);
                const userJson = await redisClient.hGet('socketToUser', socket.id);
                user = userJson ? JSON.parse(userJson) : localSocketToUser[socket.id];

                if (room) {
                    await redisClient.hDel('socketToRoom', socket.id);
                }
                if (user) {
                    await redisClient.hDel('socketToUser', socket.id);
                }
            } catch (err) {
                console.error("Redis socket disconnect error:", err);
                room = localSocketToRoom[socket.id];
                user = localSocketToUser[socket.id];
                delete localSocketToRoom[socket.id];
                delete localSocketToUser[socket.id];
            }
        } else {
            room = localSocketToRoom[socket.id];
            user = localSocketToUser[socket.id];
            delete localSocketToRoom[socket.id];
            delete localSocketToUser[socket.id];
        }

        if (room) {
            // Notify other participants in the meeting room that the user left
            socket.to(room).emit('user-left', socket.id);

            // Broadcast real-time notification
            socket.to(room).emit('receive-notification', {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                type: 'user-left',
                title: 'Participant Left',
                message: `${user ? (user.name || user.email) : 'A participant'} left the meeting`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
        if (user) {
            console.log(`User ${user.email} (${socket.id}) disconnected`);
        } else {
            console.log(`Socket disconnected: ${socket.id}`);
        }
    });

});

// 4. Run the httpServer instead of app.listen
httpServer.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
