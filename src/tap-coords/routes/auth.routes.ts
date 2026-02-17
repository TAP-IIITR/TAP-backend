import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  register,
  login,
  logout,
  resetPassword,
  getAllCoordinators,
  deleteCoordinator,
  bulkRegister,
  getSampleCSV,
} from "../controllers/auth.controllers";
import { checkTapAuth, checkTpoAuth } from "../../middleware/tapauth.middleware";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post(
  "/register",
  checkTpoAuth,
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

router.get("/coordinators", checkTpoAuth, getAllCoordinators);

router.delete("/coordinators/:id", checkTpoAuth, deleteCoordinator);

router.get("/sample-csv", checkTpoAuth, getSampleCSV);

router.post(
  "/bulk-register",
  checkTpoAuth,
  upload.single("file"),
  bulkRegister
);

export { router as tapAuthRouter };
