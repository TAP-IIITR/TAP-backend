import { Router } from "express";
import { getDashboard, updateDashboard } from "../controllers/dashboard.controllers";
import { checkAuth } from "../../middleware/auth.middleware";
import { body } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";

const router = Router();


router.get("/", checkAuth, getDashboard);

router.put(
  "/",
  checkAuth,
  [
    body("firstName")
      .isString()
      .withMessage("firstName must be a string"),
    body("lastName")
      .isString()
      .withMessage("lastName must be a string"),
    body("mobile").optional().isMobilePhone("any").withMessage("Invalid mobile number"),
    body("linkedin").optional().isURL().withMessage("LinkedIn must be a valid URL"),
    body("anyOtherDemands").optional().isString().withMessage("anyOtherDemands must be a string"),
  ],
  validateRequest,
  updateDashboard
);

export { router as dashboardRouter };