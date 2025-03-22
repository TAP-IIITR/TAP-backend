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

    // Ensure the role is 'tap'
    if (decoded.role !== 'tap') {
      throw new AuthError('Unauthorized: Only coordinators can access this resource.');
    }

    // Check if the user is logged in to Firebase Auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new AuthError('Not authenticated. Please login again.');
    }

    // Verify the coordinator exists in Firestore with the ID from the token
    const coordinatorDoc = await getDoc(doc(db, 'tap_coordinators', decoded.id));
    if (!coordinatorDoc.exists()) {
      throw new AuthError('Coordinator not found. Please login again.');
    }

    // Get the coordinator data
    const coordinatorData = coordinatorDoc.data();


    // Verify that the current Firebase user UID matches the one stored in Firestore
    if (coordinatorData.id !== currentUser.uid) {
      throw new AuthError('Invalid authentication. Please login again.');
    }

    // Set the user information on the request
    req.user = {
      id: decoded.id, // This is the Firebase UID
      role: decoded.role, // 'tap'
    };

    next();
  } catch (error) {
    next(error);
  }
};