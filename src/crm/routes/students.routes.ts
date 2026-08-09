import { Router } from "express";
import { body, param, query } from "express-validator";
import multer from "multer";
import * as XLSX from "xlsx";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  requireRole,
  AuthenticatedRequest,
} from "../../auth/middleware/requireRole";
import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { UserRole, Branch, Gender, Prisma } from "@prisma/client";
import { audit } from "../utils/audit";
import { parsePagination } from "../utils/query";

// In-memory upload (files are parsed immediately, never persisted).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();

/**
 * POST /api/crm/students/import-cgpa
 * Bulk-update student CGPA from an Excel file with columns: reg_no, cgpa.
 * (TPO/Coordinator only)
 */
router.post(
  "/import-cgpa",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  upload.single("cgpaFile"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new BadRequestError("cgpaFile (xlsx) is required");
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new BadRequestError("Excel file has no sheets");

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rows.length === 0) throw new BadRequestError("Excel file is empty");

      let updated = 0;
      let skipped = 0;
      const notFound: string[] = [];
      const invalid: string[] = [];

      for (const row of rows) {
        const reg = String(
          row["reg_no"] ?? row["regNo"] ?? row["registrationNo"] ?? ""
        ).trim();
        const rawCgpa = row["cgpa"] ?? row["CGPA"];

        if (!reg) {
          skipped++;
          continue;
        }
        // Treat blank/null cells as invalid — never coerce an empty cell to 0.
        if (rawCgpa === undefined || rawCgpa === null || rawCgpa === "") {
          invalid.push(reg);
          continue;
        }
        const cgpa = Number(rawCgpa);
        if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
          invalid.push(reg);
          continue;
        }

        const student = await prisma.student.findUnique({
          where: { registrationNo: reg },
        });
        if (!student) {
          notFound.push(reg);
          continue;
        }

        await prisma.student.update({
          where: { id: student.id },
          data: { cgpa },
        });
        updated++;
      }

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "IMPORT",
        entity: "students",
        changes: { updated, notFound: notFound.slice(0, 100), invalid: invalid.slice(0, 100) },
      });

      res.status(200).json({
        success: true,
        message: `Updated CGPA for ${updated} student(s)`,
        data: {
          totalRows: rows.length,
          updated,
          skipped,
          notFound: notFound.slice(0, 100),
          notFoundCount: notFound.length,
          invalid: invalid.slice(0, 100),
          invalidCount: invalid.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/students — list with filters + pagination */
router.get(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    query("search").optional().isString(),
    query("branch")
      .optional()
      .isIn(Object.values(Branch))
      .withMessage(`branch must be one of: ${Object.values(Branch).join(", ")}`),
    query("batch").optional().isInt({ min: 2000, max: 2100 }),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const where: Prisma.StudentWhereInput = {};

      if (req.query.search) {
        const term = String(req.query.search);
        where.OR = [
          { name: { contains: term, mode: "insensitive" } },
          { registrationNo: { contains: term, mode: "insensitive" } },
          { collegeEmail: { contains: term, mode: "insensitive" } },
        ];
      }
      if (req.query.branch) where.branch = req.query.branch as Branch;
      if (req.query.batch) where.batch = Number(req.query.batch);

      const [items, total] = await Promise.all([
        prisma.student.findMany({
          where,
          orderBy: { registrationNo: "asc" },
          skip,
          take: limit,
          include: {
            status: true,
            _count: { select: { applications: true, offers: true } },
          },
        }),
        prisma.student.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: items,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/students/:id — full profile with applications + offers */
router.get(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid student ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.id },
        include: {
          status: true,
          applications: {
            orderBy: { createdAt: "desc" },
            include: {
              opportunity: {
                include: {
                  company: { select: { id: true, name: true } },
                },
              },
            },
          },
          offers: {
            orderBy: { createdAt: "desc" },
            include: {
              opportunity: {
                include: { company: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
      if (!student) throw new NotFoundError("Student not found");
      res.status(200).json({ success: true, data: student });
    } catch (error) {
      next(error);
    }
  }
);

/** PATCH /api/crm/students/:id — update student profile (incl. CGPA, status) */
router.patch(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid student ID is required"),
    body("name").optional().isString().withMessage("name must be a string"),
    body("gender")
      .optional()
      .isIn(Object.values(Gender))
      .withMessage(`gender must be one of: ${Object.values(Gender).join(", ")}`),
    body("branch")
      .optional()
      .isIn(Object.values(Branch))
      .withMessage(`branch must be one of: ${Object.values(Branch).join(", ")}`),
    body("batch").optional().isInt({ min: 2000, max: 2100 }).withMessage("batch must be a valid year"),
    body("section").optional().isString().withMessage("section must be a string"),
    body("cgpa").optional().isFloat({ min: 0, max: 10 }).withMessage("cgpa must be 0–10"),
    body("activeBacklogs").optional().isInt({ min: 0 }).withMessage("activeBacklogs must be ≥ 0"),
    body("mobile").optional().isString().withMessage("mobile must be a string"),
    body("personalEmail").optional().isEmail().withMessage("personalEmail must be a valid email"),
    body("linkedin").optional().isString().withMessage("linkedin must be a string"),
    body("github").optional().isString().withMessage("github must be a string"),
    body("resumeUrl").optional().isString().withMessage("resumeUrl must be a string"),
    body("currentStatus").optional().isString().withMessage("currentStatus must be a string"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Student not found");

      const allowed = [
        "name",
        "gender",
        "branch",
        "batch",
        "section",
        "cgpa",
        "activeBacklogs",
        "mobile",
        "personalEmail",
        "linkedin",
        "github",
        "resumeUrl",
        "currentStatus",
      ] as const;

      const data: Prisma.StudentUpdateInput = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          (data as Record<string, unknown>)[key] = req.body[key];
        }
      }

      const student = await prisma.student.update({
        where: { id: existing.id },
        data,
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "students",
        entityId: student.id,
        changes: data as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: student });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/crm/students/:id/status — update placement status flags
 * (registered, placementEligible, higherStudies, etc.)
 */
router.put(
  "/:id/status",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid student ID is required"),
    body("registered").optional().isBoolean(),
    body("placementEligible").optional().isBoolean(),
    body("higherStudies").optional().isBoolean(),
    body("governmentExams").optional().isBoolean(),
    body("entrepreneur").optional().isBoolean(),
    body("blacklisted").optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const student = await prisma.student.findUnique({ where: { id: req.params.id } });
      if (!student) throw new NotFoundError("Student not found");

      const status = await prisma.studentStatus.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          registered: req.body.registered ?? false,
          placementEligible: req.body.placementEligible ?? false,
          higherStudies: req.body.higherStudies ?? false,
          governmentExams: req.body.governmentExams ?? false,
          entrepreneur: req.body.entrepreneur ?? false,
          blacklisted: req.body.blacklisted ?? false,
        },
        update: {
          ...(req.body.registered !== undefined && { registered: req.body.registered }),
          ...(req.body.placementEligible !== undefined && { placementEligible: req.body.placementEligible }),
          ...(req.body.higherStudies !== undefined && { higherStudies: req.body.higherStudies }),
          ...(req.body.governmentExams !== undefined && { governmentExams: req.body.governmentExams }),
          ...(req.body.entrepreneur !== undefined && { entrepreneur: req.body.entrepreneur }),
          ...(req.body.blacklisted !== undefined && { blacklisted: req.body.blacklisted }),
        },
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "students",
        entityId: student.id,
        changes: { status: req.body } as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
);

/** DELETE /api/crm/students/:id */
router.delete(
  "/:id",
  requireRole(UserRole.TPO),
  [param("id").isString().withMessage("Valid student ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Student not found");

      await prisma.student.delete({ where: { id: existing.id } });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "DELETE",
        entity: "students",
        entityId: existing.id,
      });

      res.status(200).json({ success: true, message: "Student deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as studentsRouter };
