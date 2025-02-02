import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { verifyJWT } from '../utils/jwt';

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
  try {
    const token = req.cookies.token;

    if (!token) {
       res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }
    else {

        try {
          const decoded = verifyJWT(token);
          const currentUser = auth.currentUser;
    
          if (!currentUser || currentUser.uid !== decoded.id) {
             res.status(401).json({
              success: false,
              error: 'Invalid token. Please login again.'
            });
          }
          else {
    
              req.user = {
                id: decoded.id,
                role: decoded.role
              };
        
              next();
          }
        } catch (error) {
           res.status(401).json({
            success: false,
            error: 'Invalid token. Please login again.'
          });
        }
      } 
    }
    
  catch (error) {
    next(error);
  }
};

