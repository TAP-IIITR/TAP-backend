import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';
import { verifyJWT } from '../utils/jwt';
import { AuthError } from '../errors/Auth-Error';
import { doc, getDoc } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const checkTapAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      throw new AuthError('Access denied. No token provided.');
    }

    // Verify JWT token - this will contain the coordinator ID (Firebase UID)
    const decoded = verifyJWT(token);

    // Ensure the role is 'tap' or 'tpo'
    if (decoded.role !== 'tap' && decoded.role !== 'tpo') {
      throw new AuthError('Unauthorized: Only coordinators or TPO can access this resource.');
    }

    // Verify the coordinator exists in Firestore with the ID from the token
    const coordinatorDoc = await getDoc(doc(db, 'tap_coordinators', decoded.id));
    if (!coordinatorDoc.exists()) {
      throw new AuthError('Coordinator not found. Please login again.');
    }

    // Get the coordinator data
    const coordinatorData = coordinatorDoc.data();


    // Verify the coordinator matches the ID in token (redundant check if already in token, but safe)
    if (coordinatorData.id !== decoded.id) {
      throw new AuthError('Invalid authentication. Please login again.');
    }

    // Set the user information on the request
    req.user = {
      id: decoded.id, // This is the Firebase UID
      role: decoded.role, // 'tap' or 'tpo'
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const checkTpoAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      throw new AuthError('Access denied. No token provided.');
    }

    const decoded = verifyJWT(token);

    if (decoded.role !== 'tpo') {
      throw new AuthError('Unauthorized: Only TPO can access this resource.');
    }

    const coordinatorDoc = await getDoc(doc(db, 'tap_coordinators', decoded.id));
    if (!coordinatorDoc.exists()) {
      throw new AuthError('TPO account not found. Please login again.');
    }

    const coordinatorData = coordinatorDoc.data();

    if (coordinatorData.id !== decoded.id) {
      throw new AuthError('Invalid authentication. Please login again.');
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};