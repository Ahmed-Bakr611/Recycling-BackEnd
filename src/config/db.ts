import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in environment variables");
      console.log("💡 Add MONGO_URI to your .env file:");
      console.log("   MONGO_URI=mongodb://localhost:27017/recycling-system");
      process.exit(1);
    }

    console.log("🔌 Connecting to MongoDB...");
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    
    // Provide helpful troubleshooting tips
    console.log("\n💡 Troubleshooting tips:");
    console.log("   1. Make sure MongoDB is running locally");
    console.log("   2. Check your MONGO_URI in .env file");
    console.log("   3. Try: sudo systemctl start mongod (Linux)");
    console.log("   4. Try: brew services start mongodb-community (macOS)");
    
    process.exit(1);
  }
};

export default connectDB;