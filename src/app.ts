import express from "express";
import cors from "cors";
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

// ✅ إضافة الراوتر
app.use("/api/categories", categoryRoutes);

export default app;
