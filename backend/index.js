import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import connectDb from './config/db.js';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import assistantRouter from './routes/assistant.routes.js';
import agentRouter from './routes/agent.routes.js';
import cors from 'cors';

// Production-ready CORS Configuration
const isProduction = process.env.NODE_ENV === 'production';
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;

if (isProduction && (!rawAllowedOrigins || !rawAllowedOrigins.trim())) {
  console.error("FATAL: ALLOWED_ORIGINS must be set in production mode. Refusing to start without defined CORS whitelist.");
  process.exit(1);
}

const allowedOrigins = (rawAllowedOrigins || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    // In local development, dynamically permit any local Vite/dev server port (e.g. 5173, 5174, 3000)
    if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy rejection: Origin '${origin}' is not allowed.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
};

const app = express();
app.use(cors(corsOptions));
// Handle preflight and custom CORS errors cleanly without crashing express
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith("CORS policy rejection")) {
    return res.status(403).json({
      success: false,
      error: err.message,
    });
  }
  next(err);
});
const port = process.env.PORT || 2025;

import { generalApiLimiter } from './middlewares/rateLimiter.js';

app.use(express.json());
app.use(cookieParser());

// Health check endpoint (exempt from rate limits for monitoring/uptime)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/user", generalApiLimiter, userRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/agent", generalApiLimiter, agentRouter);


if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    connectDb();
    console.log(`Server app listening on port ${port}`);
  });
}

export default app;

