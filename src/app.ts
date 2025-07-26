import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import categoryRoutes from "./routes/categoryRoutes";
import cartRoutes from "./routes/cartRoutes";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { Request, Response, NextFunction } from "express";
import setupSwagger from "./config/swagger"; // ✅ use only this

const app = express();

app.use((req, _res, next) => {
  console.log(`🔥 Request received: ${req.method} ${req.originalUrl}`);
  next();
});
const allowedOrigins = [
  "http://localhost:3000",
  "http://www.localhost:3000",
];

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!req.cookies.sessionId) {
    const sessionId = uuidv4();
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }
  next();
});

// ✅ Swagger docs at /api-docs
setupSwagger(app);

// app.use("/api/categories", categoryRoutes);
// app.use("/api/cart", cartRoutes);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err.message === "Only JPEG and PNG images are allowed") {
    return res.status(400).json({ message: err.message });
  }

  console.error("Global error:", err);
  res.status(500).json({ message: "Something went wrong" });
});
export default app;
