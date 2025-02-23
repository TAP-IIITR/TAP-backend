// routes/auth.routes.ts
import { Router } from "express";
import { body } from "express-validator";
import { 
  register, 
  login, 
  logout, 
  resetPassword, 
  confirmResetPassword 
} from "../controllers/auth.controllers";
import { checkAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

const router = Router();

// Validation rules
const registerValidation = [
  body("reg_email")
    .isEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("first_name")
    .isLength({ min: 3 })
    .withMessage("First name must be at least 3 characters"),
  body("last_name")
    .isLength({ min: 3 })
    .withMessage("Last name must be at least 3 characters"),
  body("mobile")
    .isLength({ min: 10 })
    .withMessage("Mobile number must be at least 10 digits"),
  body("linkedin")
    .isURL()
    .withMessage("Please provide a valid LinkedIn URL"),
];

const loginValidation = [
  body("reg_email")
    .isEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

// Public routes
router.post("/register", registerValidation, validateRequest, register);
router.post("/login", loginValidation, validateRequest, login);

// Protected routes
router.post("/logout", checkAuth, logout);
router.post(
  "/reset-password",
  checkAuth,
  [body("reg_email").isEmail().withMessage("Please provide a valid email")],
  validateRequest,
  resetPassword
);

router.post(
  "/confirm-reset-password",
  checkAuth,
  [
    body("code").isLength({ min: 6 }).withMessage("OTP must be 6 characters"),
    body("new_password")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters"),
  ],
  validateRequest,
  confirmResetPassword
);

export { router as authRouter };