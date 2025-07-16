// const { MongoClient } = require('mongodb');

// const uri = "mongodb://ahmed:1234@ac-o6hflbv-shard-00-00.iplauxy.mongodb.net:27017,ac-o6hflbv-shard-00-01.iplauxy.mongodb.net:27017,ac-o6hflbv-shard-00-02.iplauxy.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxx-shard-0&authSource=admin&retryWrites=true&w=majority";

// async function testConnection() {
//   const client = new MongoClient(uri, {
//     serverSelectionTimeoutMS: 10000,
//     connectTimeoutMS: 10000,
//   });
  
//   try {
//     console.log("Attempting to connect...");
//     await client.connect();
//     console.log("✅ Connected successfully to MongoDB!");
//     await client.close();
//   } catch (error) {
//     console.error("❌ Connection failed:", error.message);
//   }
// }

// testConnection();

const { MongoClient } = require("mongodb");

const uri = "mongodb://ahmed:1234@cluster0-shard-00-00.iplauxy.mongodb.net:27017,cluster0-shard-00-01.iplauxy.mongodb.net:27017,cluster0-shard-00-02.iplauxy.mongodb.net:27017/?ssl=true&replicaSet=atlas-iplauxy-shard-0&authSource=admin&retryWrites=true&w=majority";

async function run() {
  console.log("🔌 Trying to connect...");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");
  } catch (err) {
    console.error("❌ Connection error:", err.message);
  } finally {
    await client.close();
  }
}

run();
