import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";
import { verifyJWT } from "../utils/jwt";
import { AuthError } from "../errors/Auth-Error";
import { ForbiddenError } from "../errors/Forbidden-Error";
import { verifyAndAttachUser } from "../auth/middleware/requireRole";
import { doc, getDoc } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Student guard for the legacy student endpoints.
 *
 * Accepts EITHER:
 *  - the new Supabase access token (`Authorization: Bearer ...`) — verified
 *    statelessly via Supabase (role resolves to STUDENT by default)
 *  - the legacy cookie JWT (pre-migration clients)
 *
 * Attaches `req.user` with the legacy role names so existing controllers work.
 */
export const checkAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // New Supabase path — Bearer token.
    if (authHeader?.startsWith("Bearer ")) {
      await verifyAndAttachUser(req as unknown as Parameters<typeof verifyAndAttachUser>[0]);
      const sbUser = (req as unknown as { user?: { id: string; role: string } }).user;
      if (!sbUser) {
        throw new AuthError("Invalid authentication. Please login again.");
      }
      if (sbUser.role !== "STUDENT") {
        throw new ForbiddenError("Unauthorized: Only students can access this resource.");
      }
      req.user = {
        id: sbUser.id, // Supabase user id (matches Students FK column)
        role: "student",
      };
      return next();
    }

    // Legacy cookie path (pre-migration clients).
    const token = req.cookies.token;

    if (!token) {
      throw new AuthError("Access denied. No token provided.");
    }

    // Verify JWT token - this will contain the roll number as ID
    const decoded = verifyJWT(token);

    // Check if the user is logged in to Firebase Auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new AuthError("Not authenticated. Please login again.");
    }

    // Verify the student exists in Firestore with the roll number from the token
    const studentDoc = await getDoc(doc(db, "students", decoded.id));
    if (!studentDoc.exists()) {
      throw new AuthError("Student not found. Please login again.");
    }

    // Get the student data
    const studentData = studentDoc.data();

    // Check if mail is verified
    if (!studentData.emailVerified) {
      await sendEmailVerification(currentUser!);
      throw new AuthError("Email not verified. Please verify your email.");
    }

    // Verify that the current Firebase user UID matches the one stored in Firestore
    if (studentData.uid !== currentUser.uid) {
      throw new AuthError("Invalid authentication. Please login again.");
    }

    // Set the user information on the request
    req.user = {
      id: decoded.id, // This is the roll number
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
