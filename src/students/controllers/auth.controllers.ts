import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { AuthService } from "../services/Auth.service";
import { FirebaseAuthRepository } from "../repositories/FirebaseAuth.repository";
import { SERVER_CONFIG } from "../../config/serverConfig";
import { AuthenticatedRequest } from "../../types/express";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { AuthError } from "../../errors/Auth-Error";
import {
  extractBatchFromRollNumber,
  extractBranchFromRollNumber,
  extractRollNumber,
  validateIIITREmail,
} from "../../utils/validator";

const authService = new AuthService(new FirebaseAuthRepository());

export const register: RequestHandler = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      reg_email,
      mobile,
      linkedin,
      password,
      personal_email,
    } = req.body;
    const role: string = "student";

    if (!validateIIITREmail(reg_email)) {
      throw new BadRequestError(
        "Invalid email format. Must be in format: name.2023ug1058@iiitranchi.ac.in"
      );
    }

    const rollNumber = extractRollNumber(reg_email);
    if (!rollNumber) {
      throw new BadRequestError("Could not extract roll number from email");
    }

    // Extract batch and branch from roll number
    const batch = extractBatchFromRollNumber(rollNumber);
    const branch = extractBranchFromRollNumber(rollNumber);
    const cgpa = 0;

    const student = {
      firstName: first_name,
      lastName: last_name,
      regEmail: reg_email,
      personalEmail: personal_email,
      role,
      rollNumber,
      mobile,
      linkedin,
      password,
      batch,
      branch,
      cgpa,
    };

    const { id, token } = await authService.register(student);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: "Student successfully registered",
      data: { id, rollNumber },
    });
  } catch (error) {
    console.log(error, "is our error");
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email, password } = req.body;

    const { id, token } = await authService.login(reg_email, password);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { id, token },
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AuthError("Unauthorized access");
    }

    await authService.logout(userId);
    res.clearCookie("token");
    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email } = req.body;

    await authService.resetPassword(reg_email);
    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// don't need if using firebase default for password reset.
export const confirmResetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { code, new_password } = req.body;
    if (!code || !new_password) {
      throw new BadRequestError("Code and new password are required");
    }

    await authService.confirmResetPassword(code, new_password);
    res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};
