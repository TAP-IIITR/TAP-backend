import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/Error-Handler-Middleware";

const app = express();

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // Allow your frontend origin
    credentials: true, // Allow cookies/credentials to be sent
  })
);
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

// Error handler middleware
app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});