import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import categoryRoutes from "./routes/categoryRoutes";
import cartRoutes from "./routes/cartRoutes";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

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


app.use("/api/categories", categoryRoutes);
app.use('/api/cart', cartRoutes);



export default app;
