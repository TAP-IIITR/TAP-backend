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
    getAllApplications
} from "../controllers/job.controllers";

const router = Router();

// Create job
router.post(
    "/",
    checkAuth,
    [
        body("title").notEmpty().withMessage("Title is required"),
        body("JD").notEmpty().withMessage("Job description is required"),
        body("location").notEmpty().withMessage("Location is required"),
        body("package").notEmpty().withMessage("Package is required"),
        body("eligibility").notEmpty().withMessage("Eligibility criteria is required"),
        body("skills").isArray().withMessage("Skills must be an array"),
        body("deadline").isISO8601().withMessage("Valid deadline date is required"),
        body("form").isObject().withMessage("Form structure is required"),
        body("recruiter").isUUID().withMessage("Valid recruiter ID is required")
    ],
    validateRequest,
    createJob
);

// Get all jobs
router.get(
    "/",
    checkAuth,
    validateRequest,
    getAllJobs
);

// Get job by ID
router.get(
    "/:id",
    checkAuth,
    [
        param("id").isUUID().withMessage("Valid job ID is required")
    ],
    validateRequest,
    getJobById
);

// Update job
router.put(
    "/:id",
    checkAuth,
    [
        param("id").isUUID().withMessage("Valid job ID is required"),
        body("title").optional().notEmpty().withMessage("Title cannot be empty"),
        body("JD").optional().notEmpty().withMessage("Job description cannot be empty"),
        body("location").optional().notEmpty().withMessage("Location cannot be empty"),
        body("package").optional().notEmpty().withMessage("Package cannot be empty"),
        body("eligibility").optional().notEmpty().withMessage("Eligibility cannot be empty"),
        body("skills").optional().isArray().withMessage("Skills must be an array"),
        body("deadline").optional().isISO8601().withMessage("Valid deadline date is required")
    ],
    validateRequest,
    updateJob
);

// Delete job
router.delete(
    "/:id",
    checkAuth,
    [
        param("id").isUUID().withMessage("Valid job ID is required")
    ],
    validateRequest,
    deleteJob
);

router.get("/applications",
    [
        query("job").isUUID().withMessage("Valid job ID is required")
    ],
    validateRequest,
    checkAuth,
    getAllApplications
);

export { router as tapJobRouter };