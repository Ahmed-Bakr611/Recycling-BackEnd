import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import categoryRoutes from "./routes/categoryRoutes"; 

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

// Add this to your routes temporarily
app.get('/test-refresh', async (req, res) => {
  console.log('🧪 Testing refresh endpoint...');
  console.log('🍪 Cookies received:', req.cookies);
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5000/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });
    const data = await response.json();
    res.json({ 
      status: response.status, 
      data,
      originalCookies: req.cookies 
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.use("/categories", categoryRoutes);


export default app;
