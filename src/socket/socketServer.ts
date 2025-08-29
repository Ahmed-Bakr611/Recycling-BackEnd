import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { emitCurrentStockState } from './stockWatcher';
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
io.use((socket, next) => {
const token =
  socket.handshake.auth?.token ||
  socket.handshake.auth?.jwt ||
  socket.handshake.query?.token ||
  socket.handshake.headers?.authorization?.split(" ")[1];  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
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
    
    // Track socket types
    let isStockSocket = false;
    let isNotificationSocket = false;
    let stockEmissionTimeout: NodeJS.Timeout | null = null;

    // ===== NOTIFICATION SOCKET HANDLERS =====
    socket.on('join-notifications', (data) => {
      console.log(`📨 User ${socket.userId} joined notifications`);
      isNotificationSocket = true;
      socket.join(`notifications:${socket.userId}`);
      
      // Confirm successful join
      socket.emit('notification:joined', { 
        success: true, 
        userId: socket.userId 
      });
    });

    // Handle ping for notifications (with proper timestamp handling)
    socket.on('ping', (data) => {
      socket.emit('pong', { 
        timestamp: data?.timestamp || Date.now(), 
        serverTime: Date.now() 
      });
    });

    // ===== STOCK SOCKET HANDLERS =====
    socket.on('stock:subscribe', () => {
      if (!isStockSocket) {
        isStockSocket = true;
        console.log(`📦 User ${socket.userId} subscribed to stock updates`);
        socket.join('stock-updates');
        
        // Only emit stock state for stock sockets
        emitCurrentStockState(socket.id).catch(error => {
          console.error('❌ Error emitting stock state:', error);
        });
      } else {
        console.log(`📦 User ${socket.userId} already subscribed to stock updates (ignored)`);
      }
    });

    socket.on('stock:unsubscribe', () => {
      if (isStockSocket) {
        isStockSocket = false;
        console.log(`📦 User ${socket.userId} unsubscribed from stock updates`);
        socket.leave('stock-updates');
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ User ${socket.userId} disconnected:`, reason);
      if (stockEmissionTimeout) {
        clearTimeout(stockEmissionTimeout);
      }
      
      // Log socket type for debugging
      if (isNotificationSocket) {
        console.log(`📨 Notification socket disconnected for user ${socket.userId}`);
      }
      if (isStockSocket) {
        console.log(`📦 Stock socket disconnected for user ${socket.userId}`);
      }
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
