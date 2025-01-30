import { Router } from "express";
import { getJobs, getJob, applyJob } from "../controllers/job.controllers";
import { param, query } from "express-validator";

const router = Router();

router.get("/",
    [
        query("query").isString().isIn(["all", "intern", "fte", "intern_fte"]).withMessage("Invalid query"),
    ],
    /* add auth middleware here */
    getJobs
);

router.get("/:id", 
    [
        param("id").isMongoId().withMessage("Invalid job ID"),
    ],
    /* add auth middleware here */
    getJob
);

router.post("/:id/apply", 
    [
        param("id").isMongoId().withMessage("Invalid job ID"),
    ],
    /* add auth middleware here */
    applyJob
);

export { router as jobRouter };