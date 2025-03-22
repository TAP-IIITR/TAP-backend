import { Router } from "express";
import { param, query } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import { getStudent, getStudentApplications, getStudents } from "../controllers/student.controllers";
import { checkTapAuth } from "../../middleware/tapauth.middleware";

const router = Router();

router.get(
  "/",
  [
    query("branch").isString().optional(),
    query("batch").isInt().optional(),
  ],
  validateRequest,
  checkTapAuth,
  getStudents
);

router.get(
  "/:id",
  [
    param("id").isString().withMessage("Valid student ID is required"),
  ],
  validateRequest,
  checkTapAuth,
  getStudent
);

router.get(
  "/applications/:id",
  [
    param("id").isString().withMessage("Valid student ID is required"),
  ],
  validateRequest,
  checkTapAuth,
  getStudentApplications
);

export { router as tapStudentRouter };