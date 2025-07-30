/// <reference path="./types/express/index.d.ts" />
import dotenv from "dotenv";
import { createServer } from "http";
import app from "./app";
import connectDB from "./config/db";
import router from "./routes";
import { initializeSocketIO } from "./socket/socketServer";

dotenv.config();

const startServer = async () => {
  try {
    await connectDB(); // ✅ connect to MongoDB
    await app.use("/api", router()); // ✅ mount routes

    // Create HTTP server for Socket.IO
    const server = createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(server);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO server ready for connections`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
