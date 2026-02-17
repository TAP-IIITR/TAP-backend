import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/Error-Handler-Middleware";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';

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

// Student routes
import { authRouter } from "./students/routes/auth.routes";
import { dashboardRouter } from "./students/routes/dashboard.routes";
import { jobRouter } from "./students/routes/job.routes";
import { resumeRouter } from "./students/routes/resume.routes";

app.use("/api/student/resume", resumeRouter);
app.use("/api/auth/student", authRouter);
app.use("/api/dashboard/student", dashboardRouter);
app.use("/api/jobs/student", jobRouter);

// TAP Coordinator routes
import { tapAuthRouter } from "./tap-coords/routes/auth.routes";
import { tapDashboardRouter } from "./tap-coords/routes/dashboard.routes";
import { tapJobRouter } from "./tap-coords/routes/job.routes";
import { tapRecruiterRouter } from "./tap-coords/routes/recruiter.routes";
import { tapStudentRouter } from "./tap-coords/routes/student.routes";

app.use("/api/auth/tap", tapAuthRouter);
app.use("/api/dashboard/tap", tapDashboardRouter);
app.use("/api/jobs/tap", tapJobRouter);
app.use("/api/recruiter/tap", tapRecruiterRouter);
app.use("/api/student/tap", tapStudentRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the Placement Portal API of IIIT Ranchi!",
    status: "success",
  });
});

// Error handler middleware
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server is running on port ${PORT}`);
});
