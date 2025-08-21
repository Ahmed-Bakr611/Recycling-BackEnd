import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/users';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

let io: SocketIOServer | null = null;

export const initializeSocketIO = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [
        "http://localhost:3000", 
        "exp://192.168.1.100:8081",
        "exp://localhost:8081",
        "*" // Allow all origins for Expo Go during development
      ],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true // Allow Engine.IO v3 clients (for better compatibility)
  });

  // Middleware for authentication
io.use(async (socket, next) => {
const token =
  socket.handshake.auth?.token ||
  socket.handshake.auth?.jwt ||
  socket.handshake.query?.token ||
  socket.handshake.headers?.authorization?.split(" ")[1];  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
    const dbUser = await User.findById(decoded.userId).lean();
    if (!dbUser) return next(new Error('Authentication error: user not found'));
    if (dbUser.isBlocked) return next(new Error('Account blocked due to repeated reports'));

    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log(`✅ User ${socket.userId} connected via socket`);
    
    // Join user to their personal room for targeted notifications
    socket.join(`user_${socket.userId}`);
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ User ${socket.userId} disconnected:`, reason);
    });

    // Optional: Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Optional: Handle notification acknowledgment
    socket.on('notification:read', (notificationId) => {
      console.log(`📖 User ${socket.userId} read notification ${notificationId}`);
      // You could update the notification as read in the database here
    });
  });

  console.log('🚀 Socket.IO server initialized');
  return io;
};

export const getSocketIO = (): SocketIOServer | null => {
  return io;
};

// Declare socket extensions for TypeScript
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    userRole?: string;
  }
}
