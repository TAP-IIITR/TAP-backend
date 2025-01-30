import { Router } from "express";
import { getDashboard, updateResume } from "../controllers/dashboard.controllers";

const router = Router();

router.get("/", 
    /* add auth middleware here */
    getDashboard
);

router.put("/", 
    /* add auth middleware here */
    updateResume
);

export { router as dashboardRouter };