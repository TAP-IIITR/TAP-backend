import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';
import { verifyJWT } from '../utils/jwt';
import { AuthError } from '../errors/Auth-Error';
import { doc, getDoc } from 'firebase/firestore';

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
    // console.log(token, 'is our token');

    if (!token) {
      throw new AuthError('Access denied. No token provided.');
    }

    // Verify JWT token - this will contain the roll number as ID
    const decoded = verifyJWT(token);
    
    // Check if the user is logged in to Firebase Auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new AuthError('Not authenticated. Please login again.');
    }

    // Verify the student exists in Firestore with the roll number from the token
    const studentDoc = await getDoc(doc(db, 'students', decoded.id));
    if (!studentDoc.exists()) {
      throw new AuthError('Student not found. Please login again.');
    }

    // Get the student data
    const studentData = studentDoc.data();
    
    // Verify that the current Firebase user UID matches the one stored in Firestore
    if (studentData.uid !== currentUser.uid) {
      throw new AuthError('Invalid authentication. Please login again.');
    }

    // Set the user information on the request
    req.user = {
      id: decoded.id, // This is the roll number
      role: decoded.role
    };

    next();
  } catch (error) {
    next(error);
  }
};