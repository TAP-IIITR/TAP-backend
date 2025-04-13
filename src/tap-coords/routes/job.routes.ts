import { Router } from "express";
import { body, param, query } from "express-validator";
import { checkAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getAllApplications,
  getPendingVerifications,
  verifyJob,
  updateApplicationStatus,
  sendJobNotifications,
} from "../controllers/job.controllers";
import { checkTapAuth } from "../../middleware/tapauth.middleware";

const router = Router();

// Create job
router.post(
  "/",
  checkTapAuth,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("JD").notEmpty().withMessage("Job description is required"),
    body("location").notEmpty().withMessage("Location is required"),
    body("package").notEmpty().withMessage("Package is required"),
    body("eligibility")
      .notEmpty()
      .withMessage("Eligibility criteria is required"),
    body("eligibleBatches")
      .isArray()
      .withMessage("Eligible Batches must be an array"),
    body("deadline").isISO8601().withMessage("Valid deadline date is required"),
  ],
  validateRequest,
  createJob
);

// Get all jobs
router.get("/", checkTapAuth, validateRequest, getAllJobs);
router.get("/applications", checkTapAuth, validateRequest, getAllApplications);

// Get job by ID
router.get("/:id", checkTapAuth, validateRequest, getJobById);

// Update job
router.put(
  "/:id",
  checkTapAuth,
  [
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    body("JD")
      .optional()
      .notEmpty()
      .withMessage("Job description cannot be empty"),
    body("location")
      .optional()
      .notEmpty()
      .withMessage("Location cannot be empty"),
    body("package")
      .optional()
      .notEmpty()
      .withMessage("Package cannot be empty"),
    body("eligibility")
      .optional()
      .notEmpty()
      .withMessage("Eligibility cannot be empty"),
    body("eligibleBatches")
      .optional()
      .isArray()
      .withMessage("eligibleBatches must be an array"),
    body("deadline")
      .optional()
      .isISO8601()
      .withMessage("Valid deadline date is required"),
  ],
  validateRequest,
  updateJob
);
// You can use this for reminder notification / manual triggering
router.post(
  "/:id/notify",
  checkTapAuth,
  [param("id").isString().withMessage("Valid job ID is required")],
  validateRequest,
  sendJobNotifications
);
// Add these routes to the existing tapJobRouter
// router.put(
//     "/applications/:jobId/:studentId",
//     checkTapAuth,
//     [
//       param("jobId").isUUID().withMessage("Valid job ID is required"),
//       param("studentId").isString().withMessage("Valid student ID is required"),
//       body("status")
//         .isIn(["selected", "rejected", "under_review", "pending"])
//         .withMessage("Status must be 'selected', 'rejected', 'under_review', or 'pending'"),
//     ],
//     validateRequest,
//     updateApplicationStatus
//   );
router.get("/pending-verifications", checkTapAuth, getPendingVerifications);

router.put(
  "/verify/:id",
  checkTapAuth,
  [
    body("action")
      .isIn(["approve", "reject"])
      .withMessage("Action must be 'approve' or 'reject'"),
  ],
  validateRequest,
  verifyJob
);
// Delete job
router.delete(
  "/:id",
  checkTapAuth,
  [param("id").isUUID().withMessage("Valid job ID is required")],
  validateRequest,
  deleteJob
);

// router.get("/applications",
//     validateRequest,
//     checkTapAuth,
//     getAllJobs
// );

export { router as tapJobRouter };
