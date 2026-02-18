// routes/auth.routes.ts
import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  logout,
  resetPassword,
  confirmResetPassword,
} from "../controllers/auth.controllers";
import { checkAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Student Auth
 *   description: Student authentication and account management
 */

/**
 * @swagger
 * /api/auth/student/register:
 *   post:
 *     summary: Register a new student
 *     tags: [Student Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reg_email
 *               - personal_email
 *               - password
 *               - first_name
 *               - last_name
 *               - mobile
 *               - linkedin
 *             properties:
 *               reg_email:
 *                 type: string
 *               personal_email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               mobile:
 *                 type: string
 *               linkedin:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student registered successfully
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /api/auth/student/login:
 *   post:
 *     summary: Student login
 *     tags: [Student Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reg_email
 *               - password
 *             properties:
 *               reg_email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized
 */

// Validation rules
const registerValidation = [
  body("reg_email")
    .isEmail()
    .withMessage("Please provide a valid college email"),
  body("personal_email")
    .isEmail()
    .withMessage("Please provide a valid personal email"),
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
  body("linkedin").isURL().withMessage("Please provide a valid LinkedIn URL"),
];

const loginValidation = [
  body("reg_email").isEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

// Public routes
router.post("/register", registerValidation, validateRequest, register);
router.post("/login", loginValidation, validateRequest, login);
router.post(
  "/forgot-password",
  [body("reg_email").isEmail().withMessage("Please provide a valid email")],
  validateRequest,
  resetPassword
);

// Protected routes
router.post("/logout", checkAuth, logout);
router.post(
  "/reset-password",
  checkAuth,
  [body("reg_email").isEmail().withMessage("Please provide a valid email")],
  validateRequest,
  resetPassword
);

// don't need if using firebase default for password reset.
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
