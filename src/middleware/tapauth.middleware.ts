import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../utils/jwt";
import { AuthError } from "../errors/Auth-Error";
import { ForbiddenError } from "../errors/Forbidden-Error";
import { verifyAndAttachUser } from "../auth/middleware/requireRole";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { UserRole } from "@prisma/client";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/** Legacy role names the TAP controllers expect ('tap' / 'tpo'). */
const LEGACY_ROLE: Record<string, string> = {
  [UserRole.TPO]: "tpo",
  [UserRole.COORDINATOR]: "tap",
  [UserRole.STUDENT]: "student",
};

/**
 * Shared auth resolution for the legacy TAP endpoints.
 *
 * Accepts EITHER:
 *  - the new Supabase access token (`Authorization: Bearer ...`) — verified
 *    statelessly via Supabase and cross-checked against the coordinators table
 *  - the legacy cookie JWT (pre-migration clients)
 *
 * Attaches `req.user` with the legacy role names ('tap' / 'tpo') so the
 * existing Firestore controllers keep working unchanged.
 */
async function resolveTapUser(req: AuthenticatedRequest): Promise<void> {
  const authHeader = req.headers.authorization;

  // New Supabase path — Bearer token.
  if (authHeader?.startsWith("Bearer ")) {
    // Sets req.user = { id, email, role: UserRole } (verified server-side).
    await verifyAndAttachUser(req as unknown as Parameters<typeof verifyAndAttachUser>[0]);
    const sbUser = (req as unknown as { user?: { id: string; role: UserRole } }).user;
    if (!sbUser) {
      throw new AuthError("Invalid authentication. Please login again.");
    }
    req.user = {
      id: sbUser.id,
      role: LEGACY_ROLE[sbUser.role] || "student",
    };
    return;
  }

  // Legacy cookie path (pre-migration clients).
  const token = req.cookies.token;
  if (!token) {
    throw new AuthError("Access denied. No token provided.");
  }

  const decoded = verifyJWT(token);
  if (decoded.role !== "tap" && decoded.role !== "tpo") {
    throw new AuthError(
      "Unauthorized: Only coordinators or TPO can access this resource."
    );
  }

  const coordinatorDoc = await getDoc(doc(db, "tap_coordinators", decoded.id));
  if (!coordinatorDoc.exists()) {
    throw new AuthError("Coordinator not found. Please login again.");
  }

  const coordinatorData = coordinatorDoc.data();
  if (coordinatorData.id !== decoded.id) {
    throw new AuthError("Invalid authentication. Please login again.");
  }

  req.user = {
    id: decoded.id,
    role: decoded.role,
  };
}

export const checkTapAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    await resolveTapUser(req);
    if (!req.user || (req.user.role !== "tap" && req.user.role !== "tpo")) {
      throw new ForbiddenError(
        "Unauthorized: Only coordinators or TPO can access this resource."
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const checkTpoAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    await resolveTapUser(req);
    if (!req.user || req.user.role !== "tpo") {
      throw new ForbiddenError("Unauthorized: Only TPO can access this resource.");
    }
    next();
  } catch (error) {
    next(error);
  }
};
