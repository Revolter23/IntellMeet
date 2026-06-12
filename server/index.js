import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import main from './database/mongodb.js'; // Ensure database starts up as well

const app = express();
const port = 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());

main()

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// 1. Wrap the express application in an HTTP server
const httpServer = createServer(app);

// 2. Initialize Socket.io and allow CORS from your React client (typically on port 5173)
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// 3. Set up event handlers for socket connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Example handler for a custom event
    socket.on('message', (data) => {
        console.log(`Received message: ${data}`);
        // Broadcast the message back to all other connected clients
        socket.broadcast.emit('message', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// 4. Run the httpServer instead of app.listen
httpServer.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
