import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import categoryRoutes from "./routes/categoryRoutes"; // تأكدي من المسار الصحيح

const app = express();

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000", // حددي origin لو محتاجة
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// ✅ إضافة الراوتر
app.use("/api/categories", categoryRoutes);

export default app;
