import { Router } from "express";
import { body, param } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  requireAuth,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/requireRole";
import { supabaseAdmin } from "../../config/supabase";
import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { UserRole } from "@prisma/client";

const router = Router();

/**
 * GET /api/auth/me
 * Returns the current user with their server-resolved role.
 * Works for students, coordinators, and TPOs.
 */
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user!;
    // Middleware already resolved the role; reuse it (avoid a 2nd admin round-trip).
    const role = user.role;

    // Attach role-specific profile data
    let profile: Record<string, unknown> | null = null;
    if (role === UserRole.TPO || role === UserRole.COORDINATOR) {
      profile = await prisma.coordinator.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
    } else if (role === UserRole.STUDENT) {
      profile = await prisma.student.findUnique({
        where: { authUid: user.id },
        select: {
          id: true,
          registrationNo: true,
          name: true,
          collegeEmail: true,
          branch: true,
          batch: true,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: { id: user.id, email: user.email, role, profile },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/coordinators  (TPO only)
 * Creates a new coordinator or TPO via Supabase admin (sets app_metadata.role,
 * which the DB trigger turns into a coordinators row).
 */
router.post(
  "/coordinators",
  requireRole(UserRole.TPO),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role")
      .optional()
      .isIn([UserRole.COORDINATOR, UserRole.TPO])
      .withMessage("Role must be coordinator or tpo"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, email, password } = req.body;
      const role: UserRole = req.body.role || UserRole.COORDINATOR;

      const { data: users } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existing = users.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (existing) {
        throw new BadRequestError("A user with this email already exists");
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { role },
      });
      if (error) {
        throw new BadRequestError(error.message);
      }

      // The DB trigger creates the coordinators row; verify it exists.
      const coordinator = await prisma.coordinator.findUnique({
        where: { id: data.user.id },
      });

      res.status(201).json({
        success: true,
        message: `${role === UserRole.TPO ? "TPO" : "Coordinator"} created successfully`,
        data: { id: data.user.id, email, role, provisioned: !!coordinator },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/coordinators  (TPO only)
 */
router.get(
  "/coordinators",
  requireRole(UserRole.TPO),
  async (_req, res, next) => {
    try {
      const coordinators = await prisma.coordinator.findMany({
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json({ success: true, data: coordinators });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/auth/coordinators/:id  (TPO only)
 * Deletes the Supabase auth user + coordinators row.
 */
router.delete(
  "/coordinators/:id",
  requireRole(UserRole.TPO),
  [param("id").isString().withMessage("Valid coordinator ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await prisma.coordinator.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError("Coordinator not found");
      }

      await supabaseAdmin.auth.admin.deleteUser(id).catch(() => {});
      await prisma.coordinator.delete({ where: { id } });

      res.status(200).json({ success: true, message: "Coordinator deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as authRouter };
