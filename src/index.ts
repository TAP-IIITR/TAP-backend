import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/Error-Handler-Middleware";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ⚠️ Needed if you're behind a proxy (like Railway, Vercel, or Heroku)
app.set("trust proxy", 1); // Allows secure cookies to work behind proxy

// Parses incoming JSON payloads
app.use(express.json());

// CORS must be set before routes
app.use(
  cors({
    origin: "https://tap-iiitr-three.vercel.app",
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
  res.send("Welcome to the Placement Portal API of IIIT Ranchi!");
});

// Error handler middleware
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT} `);
});
