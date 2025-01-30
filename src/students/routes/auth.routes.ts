import { Router } from "express";
import { body } from "express-validator";
import { confirmResetPassword, login, logout, register, resetPassword } from "../controllers/auth.controllers";

const router = Router();

router.post(
  "/register",
  [
    body("reg_email").isEmail(), 
    body("password").isLength({ min: 8 }),
    body("first_name").isLength({ min: 3 }),
    body("last_name").isLength({ min: 3 }),
    body("mobile").isLength({ min: 10 }),
    body("linkedin").isURL(),
  ],
  register
);

router.post("/login", 
    [
        body("reg_email").isEmail(),
        body("password").isLength({ min: 8 }),
    ],
    login
);

router.get("/logout", 
    /* add auth middleware here */
    logout
);


// reset password in 2 steps
router.get("/reset-password", 
    [
        body("reg_email").isEmail(),
    ],
    resetPassword
);

router.post("/confirm-reset-password", 
    [
        body("otp").isLength({ min: 6 }),
        body("password").isLength({ min: 8 }),
    ],
    confirmResetPassword
);



export { router as authRouter }

