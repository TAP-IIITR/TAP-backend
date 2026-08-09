import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../../config/supabase";
import { prisma } from "../../config/prisma";
import { AuthError } from "../../errors/Auth-Error";
import { ForbiddenError } from "../../errors/Forbidden-Error";
import { UserRole } from "@prisma/client";

/**
 * Supabase user attached to the request after token verification.
 * id = supabase auth.users.id — matches Coordinators/Students FK columns.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const extractToken = (req: Request): string | null => {
  // Bearer header (recommended for API calls)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Cookie fallback (browser flows) — verify cookie name against your client lib
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.["sb-access-token"] || null;
};

/**
 * Resolves the user's role WITHOUT trusting client-supplied metadata.
 *
 * Security: `user_metadata` is client-writable at signup, so it can NEVER
 * grant privileged roles. We only trust `app_metadata` (writable exclusively
 * via the service role / admin API) and cross-check coordinator/TPO roles
 * against the `coordinators` table before granting elevated access.
 */
async function resolveRole(supabaseUserId: string): Promise<UserRole> {
  const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(
    supabaseUserId
  );
  if (error || !user?.user) {
    throw new AuthError("Could not resolve user role.");
  }

  const appRole = user.user.app_metadata?.role as UserRole | undefined;
  if (appRole === UserRole.TPO || appRole === UserRole.COORDINATOR) {
    // Elevated roles must exist as an active coordinator row — belt and braces.
    const coordinator = await prisma.coordinator.findUnique({
      where: { id: supabaseUserId },
      select: { id: true, isActive: true, role: true },
    });
    if (!coordinator || !coordinator.isActive) {
      throw new ForbiddenError("Coordinator account is not active.");
    }
    return coordinator.role;
  }
  return UserRole.STUDENT;
}

/**
 * Core verification — extracts the token, verifies it with Supabase,
 * resolves the role server-side, and attaches the user to the request.
 */
export async function verifyAndAttachUser(
  req: AuthenticatedRequest
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    throw new AuthError("Access denied. No token provided.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError("Invalid or expired token. Please login again.");
  }

  const role = await resolveRole(data.user.id);

  req.user = {
    id: data.user.id,
    email: data.user.email || "",
    role,
  };
}

/**
 * Verifies the Supabase access token (stateless RS256 verification via
 * Supabase's getUser — no client SDK singleton, works for any number of users).
 * Replaces the broken Firebase `auth.currentUser` middleware.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    await verifyAndAttachUser(req);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role guard — factory that returns middleware requiring one of the given roles.
 * Usage: router.get("/", requireRole(UserRole.TPO, UserRole.COORDINATOR), handler)
 */
export const requireRole =
  (...roles: UserRole[]) =>
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      await verifyAndAttachUser(req);
      if (!req.user || !roles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Access forbidden. Required roles: ${roles.join(", ")}`
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
