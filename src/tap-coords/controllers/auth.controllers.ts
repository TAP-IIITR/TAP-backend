import { RequestHandler } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { TapAuthService } from '../services/Tapauth.service';
import { TapAuthRepository } from '../repositories/TapAuth.repository';
import { BadRequestError } from '../../errors/Bad-Request-Error';
import { SERVER_CONFIG } from '../../config/serverConfig';

const tapAuthService = new TapAuthService(new TapAuthRepository());

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email, password } = req.body;
    if (!reg_email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const { id, token } = await tapAuthService.login(reg_email, password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: SERVER_CONFIG.NODE_ENV === 'production',
      maxAge: SERVER_CONFIG.COOKIE_MAX_AGE,
    });

    res.status(200).json({ 
      success: true, 
      message: 'Login successful', 
      data: { id } 
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new BadRequestError('User authentication required');
    }

    await tapAuthService.logout(userId, role);
    res.clearCookie('token');
    res.status(200).json({ 
      success: true, 
      message: 'Logout successful' 
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reg_email } = req.body;
    const role = req.user?.role;

    if (!reg_email || !role) {
      throw new BadRequestError('Email and authentication required');
    }

    await tapAuthService.resetPassword(reg_email, role);
    res.status(200).json({ 
      success: true, 
      message: 'Password reset email sent successfully' 
    });
  } catch (error) {
    next(error);
  }
};

export const confirmResetPassword: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { code, new_password } = req.body;
    const role = req.user?.role;

    if (!code || !new_password || !role) {
      throw new BadRequestError('Code, new password, and authentication required');
    }

    await tapAuthService.confirmResetPassword(code, new_password, role);
    res.status(200).json({ 
      success: true, 
      message: 'Password reset successful' 
    });
  } catch (error) {
    next(error);
  }
};
