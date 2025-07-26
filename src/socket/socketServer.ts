import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

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
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      console.log('❌ Socket auth failed: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // Use the same JWT_ACCESS_SECRET as the main app
      const accessSecret = process.env.JWT_ACCESS_SECRET as string;
      if (!accessSecret) {
        console.error('❌ JWT_ACCESS_SECRET is not defined in environment variables');
        return next(new Error('Authentication error: Server configuration error'));
      }

      console.log(`🔍 Socket auth attempt - Token (first 20 chars): ${token.substring(0, 20)}...`);
      console.log(`🔍 Using JWT_ACCESS_SECRET: ${accessSecret.substring(0, 10)}...`);
      
      const decoded = jwt.verify(token, accessSecret) as any;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      
      console.log(`🔐 User ${decoded.userId} authenticated via socket successfully`);
      console.log(`🔐 User role: ${decoded.role}`);
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error);
      console.error(`❌ Token that failed: ${token.substring(0, 50)}...`);
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
