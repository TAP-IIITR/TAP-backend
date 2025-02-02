import express from "express";
import 'express-async-errors';
import cors from "cors"
import cookieParser from "cookie-parser"
import { errorHandler } from "./middleware/Error-Handler-Middleware";
const app = express();

app.use(express.json());
app.use(cors());
app.use(cookieParser());


import { authRouter } from "./students/routes/auth.routes";
import { dashboardRouter } from "./students/routes/dashboard.routes";
import { jobRouter } from "./students/routes/job.routes";

app.use("/api/auth/student", authRouter);
app.use("/api/dashboard/student", dashboardRouter);
app.use("/api/jobs/student", jobRouter);

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

