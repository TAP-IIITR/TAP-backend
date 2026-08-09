import express from "express";
import "express-async-errors";
import cors from "cors";
import { SERVER_CONFIG } from './config/serverConfig';
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/Error-Handler-Middleware";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit hit for IP: ${req.ip}`);
    res.status(429).json({ error: "Rate limit exceeded", statusCode: 429 });
  },
});

dotenv.config();

const app = express();

// // ⚠️ Needed if you're behind a proxy (like Railway, Vercel, or Heroku)
app.set("trust proxy", 1);
app.use(limiter);
// Parses incoming JSON payloads
app.use(express.json());
app.use(requestLogger);

// CORS must be set before routes
app.use(
  cors({
    origin: ["https://tap-iiitr-three.vercel.app", "http://localhost:5173"],
    credentials: true,
  })
);

// Parses cookies before routes
app.use(cookieParser());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Supabase RBAC auth (Phase A) — replaces Firebase auth
import { authRouter as supabaseAuthRouter } from "./auth/routes/auth.routes";
app.use("/api/auth", supabaseAuthRouter);

// Coordinator CRM API (Phase B) — Supabase/Prisma
import { crmRouter } from "./crm/routes";
app.use("/api/crm", crmRouter);

// Student portal API (Phase C) — Supabase/Prisma
import { studentPortalRouter } from "./student/routes";
app.use("/api/student", studentPortalRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the Placement Portal API of IIIT Ranchi!",
    status: "success",
  });
});

// Error handler middleware
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server is running on port ${PORT}`);
});
