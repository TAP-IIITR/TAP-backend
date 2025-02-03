import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { verifyJWT } from '../utils/jwt';
import { AuthError } from '../errors/Auth-Error';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const checkAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;

  if (!token) {
    throw new AuthError('Access denied. No token provided.');
  }

  const decoded = verifyJWT(token);
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== decoded.id) {
    throw new AuthError('Invalid token. Please login again.');
  }

  req.user = {
    id: decoded.id,
    role: decoded.role
  };

  next();
};

