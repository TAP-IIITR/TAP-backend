import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  register,
  login,
  logout,
  resetPassword,
} from "../controllers/auth.controllers";
import { checkTapAuth } from "../../middleware/tapauth.middleware";

const router = Router();

router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validateRequest,
  register
);

router.post("/login", [], validateRequest, login);

router.post("/logout", checkTapAuth, logout);

router.post(
  "/reset-password",
  [body("email").isEmail().withMessage("Please provide a valid email")],
  validateRequest,
  resetPassword
);

export { router as tapAuthRouter };
