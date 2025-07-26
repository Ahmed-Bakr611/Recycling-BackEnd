/// <reference path="./types/express/index.d.ts" />
import dotenv from "dotenv";
import app from "./app";
import connectDB from "./config/db";
import router from "./routes";

dotenv.config();

const startServer = async () => {
  try {
    await connectDB(); // ✅ connect to MongoDB
    await app.use("/api", router()); // ✅ mount routes

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
