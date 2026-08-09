import { Router } from "express";
import { studentRouter } from "./student.routes";

const router = Router();
router.use("/", studentRouter);

export { router as studentPortalRouter };
