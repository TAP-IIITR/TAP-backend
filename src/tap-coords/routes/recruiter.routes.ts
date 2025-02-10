import { Router } from "express";
import { checkAuth } from "../../middleware/auth.middleware";
import { query } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import { deleteRecruiter, getAllRecruiters, getRecruiterById, verifyRecruiter } from "../controllers/recruiter.controllers";

const router = Router();

router.get("/", checkAuth, getAllRecruiters)

router.get("/:id",
    [
        query("id").isUUID().withMessage("Invalid UUID")
    ],
    validateRequest,
    checkAuth,
    getRecruiterById
)

router.put("/:id",
    [
        query("id").isUUID().withMessage("Invalid UUID")
    ],
    validateRequest,
    checkAuth,
    verifyRecruiter
)

router.delete("/:id",
    [
        query("id").isUUID().withMessage("Invalid UUID")
    ],
    validateRequest,
    checkAuth,
    deleteRecruiter
)

export { router as tapRecruiterRouter };