import { Router } from "express";
import {
  getJobs,
  getJob,
  applyJob,
  getMyApplications,
  getapp,
} from "../controllers/job.controllers";
import { body, param, query } from "express-validator";
import { checkAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

const router = Router();

// POST /jobs/admin

router.post(
  "/admin",
  [
    body("title").exists().withMessage("Title is required").isString(),
    body("jd").exists().withMessage("Job description is required").isString(),
    body("location").exists().withMessage("Location is required").isString(),
    body("salaryPackage")
      .exists()
      .withMessage("Salary package is required")
      .isString(),
    body("eligibility")
      .exists()
      .withMessage("Eligibility is required")
      .isString(),
    body("eligibleBatches")
      .exists()
      .withMessage("eligibleBatches are required")
      .isArray(),
    body("deadline").exists().withMessage("Deadline is required"),
    body("recruiter").exists().withMessage("Recruiter is required").isString(),
    body("job_type")
      .exists()
      .withMessage("Job type is required")
      .isIn(["intern", "fte", "intern_fte"])
      .withMessage("job_type must be one of intern, fte, intern_fte"),
  ],
  checkAuth,
  validateRequest
);

// GET /jobs

router.get(
  "/",
  [
    query("query")
      .optional()
      .isString()
      .withMessage("Query must be a string")
      .custom((value) => {
        const allowed = ["all", "intern", "fte", "intern_fte"];
        if (!allowed.includes(value.toLowerCase())) {
          throw new Error(`Query must be one of ${allowed.join(", ")}`);
        }
        return true;
      }),
  ],
  checkAuth,
  validateRequest,
  getJobs
);

// GET /jobs/:id
router.get("/mm", checkAuth, validateRequest, getMyApplications);
router.get("/:id", checkAuth, validateRequest, getJob);

// POST /jobs/:id/apply

router.post("/:id/apply", checkAuth, validateRequest, applyJob);

export { router as jobRouter };
