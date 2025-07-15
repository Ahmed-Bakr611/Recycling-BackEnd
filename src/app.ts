import express from "express";
import cors from "cors";
import categoryRoutes from "./routes/categoryRoutes"; // تأكدي من المسار الصحيح

const app = express();

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/categories", categoryRoutes);

export default app;
