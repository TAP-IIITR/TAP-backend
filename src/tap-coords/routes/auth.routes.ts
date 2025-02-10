import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import { checkAuth } from "../../middleware/auth.middleware";
import { confirmResetPassword, login, logout, resetPassword } from "../controllers/auth.controllers";

const router = Router();

router.post('/login',
    [
        body('email').isEmail().withMessage('Email must be valid'),
        body('password').notEmpty().withMessage('You must supply a password')
    ],
    validateRequest,
    login
);

router.get('/logout', checkAuth, logout);


router.post(
    "/reset-password",
    checkAuth,
    [body("email").isEmail().withMessage("Please provide a valid email")],
    validateRequest,
    resetPassword
);

router.post(
    "/confirm-reset-password",
    checkAuth,
    [
        body("otp").isLength({ min: 6 }).withMessage("OTP must be 6 characters"),
        body("new_password")
            .isLength({ min: 8 })
            .withMessage("New password must be at least 8 characters"),
    ],
    validateRequest,
    confirmResetPassword
);

export { router as tapAuthRouter };