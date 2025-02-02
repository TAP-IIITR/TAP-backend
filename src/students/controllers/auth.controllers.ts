import { RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import { AuthService } from '../services/Auth.service';
import { FirebaseAuthRepository } from '../repositories/FirebaseAuth.repository';
import { SERVER_CONFIG } from '../../config/serverConfig';
import { AuthenticatedRequest } from '../../types/express';

const authService = new AuthService(new FirebaseAuthRepository());

export const register: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { first_name, last_name, reg_email, mobile, linkedin, password } = req.body;
    const student = { firstName: first_name, lastName: last_name, regEmail: reg_email, mobile, linkedin, password };
    const { id, token } = await authService.register(student);

    res.cookie('token', token, {
      httpOnly: true,
      secure: SERVER_CONFIG.NODE_ENV === 'production',
      maxAge: SERVER_CONFIG.COOKIE_MAX_AGE,
    });

    res.status(201).json({
      message: 'Student successfully registered',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { reg_email, password } = req.body;
    const { id, token } = await authService.login(reg_email, password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: SERVER_CONFIG.NODE_ENV === 'production',
      maxAge: SERVER_CONFIG.COOKIE_MAX_AGE,
    });

    res.status(200).json({
      message: 'Login successful',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await authService.logout(userId);
    res.clearCookie('token');

    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email } = req.body;
    await authService.resetPassword(reg_email);

    res.status(200).json({
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const confirmResetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { code, new_password } = req.body;
    await authService.confirmResetPassword(code, new_password);

    res.status(200).json({
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};
