import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/Error-Handler-Middleware";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middlewares
// app.set("trust proxy", 1);
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://placements-iiitr.vercel.app",
      "https://tap-iiitr-three.vercel.app/",
    ], // Allow frontend origins
    credentials: true, // Allow cookies/credentials to be sent
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow required methods
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

app.get("/", (req, res) => {
  res.send("Welcome to the Placement Portal API of IIIT Ranchi!");
});

// Error handler middleware
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT} `);
});
