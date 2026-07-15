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

main()

app.use("/auth", AuthRoutes);
app.use("/meetings", MeetingRoutes);

// 1. Wrap the express application in an HTTP server
const httpServer = createServer(app);

// 2. Initialize Socket.io and allow CORS from your React client (typically on port 5173)
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Fallback in-memory mappings if Redis is down
const localSocketToRoom = {};
const localSocketToUser = {};

// 3. Set up event handlers for socket connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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
