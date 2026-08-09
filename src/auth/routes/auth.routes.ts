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
import { UserRole, Branch } from "@prisma/client";

const router = Router();

// All staff/student accounts must use the institute domain. Demo accounts
// (demo.*@iiitranchi.ac.in) already comply, so no bypass is needed.
const COLLEGE_EMAIL_DOMAIN = "iiitranchi.ac.in";
const isCollegeEmail = (email: string) =>
  email.toLowerCase().endsWith(`@${COLLEGE_EMAIL_DOMAIN}`);

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
    body("email")
      .isEmail()
      .withMessage("Valid email is required")
      .custom((v: string) => isCollegeEmail(v))
      .withMessage(`Email must be a @${COLLEGE_EMAIL_DOMAIN} address`),
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
      const createdAuthId = data.user.id;

      try {
        // Create the coordinators row explicitly. The DB trigger on auth.users
        // is NOT fired by GoTrue's admin createUser path (session replication
        // role), so we can't rely on it — it stays as a safety net only.
        const coordinator = await prisma.coordinator.upsert({
          where: { id: createdAuthId },
          update: { name, email, role },
          create: { id: createdAuthId, name, email, role },
        });

        res.status(201).json({
          success: true,
          message: `${role === UserRole.TPO ? "TPO" : "Coordinator"} created successfully`,
          data: { id: createdAuthId, email, role, provisioned: true },
        });
      } catch (dbError) {
        // Roll back the auth account so retries stay clean — no orphan logins.
        await supabaseAdmin.auth.admin
          .deleteUser(createdAuthId)
          .catch((rollbackErr) =>
            console.error("[auth] failed to roll back auth user", createdAuthId, rollbackErr)
          );
        next(dbError);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/students  (TPO only)
 * Provisions a student account: creates the Supabase auth user (role=STUDENT,
 * email confirmed so login works immediately with the temp password) and the
 * Student + StudentStatus rows. This is the only way students get accounts —
 * self-registration is intentionally disabled (pre-provision model).
 */
router.post(
  "/students",
  requireRole(UserRole.TPO),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("registrationNo").notEmpty().withMessage("Registration number is required"),
    body("collegeEmail")
      .isEmail()
      .withMessage("Valid email is required")
      .custom((v: string) => isCollegeEmail(v))
      .withMessage(`Email must be a @${COLLEGE_EMAIL_DOMAIN} address`),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("branch")
      .isIn(Object.values(Branch))
      .withMessage("Branch must be one of CSE, ECE, CSE_DSAI, ECE_ESIOT"),
    body("batch").isInt({ min: 2020, max: 2035 }).withMessage("Batch must be a graduating year"),
    body("cgpa").optional().isFloat({ min: 0, max: 10 }).withMessage("CGPA must be between 0 and 10"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, registrationNo, collegeEmail, password, branch, batch } = req.body;
      const cgpa = req.body.cgpa != null ? Number(req.body.cgpa) : null;

      // Duplicate checks before creating anything.
      const existingStudent = await prisma.student.findFirst({
        where: { OR: [{ registrationNo }, { collegeEmail }] },
      });
      if (existingStudent) {
        throw new BadRequestError(
          "A student with this registration number or email already exists"
        );
      }

      const { data: users } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existingAuth = users.users.find(
        (u) => u.email?.toLowerCase() === collegeEmail.toLowerCase()
      );
      if (existingAuth) {
        throw new BadRequestError("A user with this email already exists");
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: collegeEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { role: UserRole.STUDENT },
      });
      if (error) {
        throw new BadRequestError(error.message);
      }
      const createdAuthId = data.user.id;

      try {
        // Create the Student row (+ StudentStatus with registered=true) in a
        // transaction so a failure can't leave a half-provisioned record.
        const student = await prisma.$transaction(async (tx) => {
          const s = await tx.student.create({
            data: {
              authUid: createdAuthId,
              registrationNo,
              name,
              collegeEmail,
              branch: branch as Branch,
              batch: Number(batch),
              cgpa,
            },
          });
          await tx.studentStatus.create({
            data: { studentId: s.id, registered: true },
          });
          return s;
        });

        res.status(201).json({
          success: true,
          message: "Student provisioned successfully",
          data: {
            id: student.id,
            registrationNo,
            collegeEmail,
            branch,
            batch: Number(batch),
            login: "immediate (email already confirmed — use the temp password)",
          },
        });
      } catch (dbError) {
        // Roll back the auth account so retries stay clean — no orphan logins.
        await supabaseAdmin.auth.admin
          .deleteUser(createdAuthId)
          .catch((rollbackErr) =>
            console.error("[auth] failed to roll back auth user", createdAuthId, rollbackErr)
          );
        next(dbError);
      }
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
