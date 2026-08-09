import { Router } from "express";
import { body, param, query } from "express-validator";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  requireRole,
  AuthenticatedRequest,
} from "../../auth/middleware/requireRole";
import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import {
  UserRole,
  RoundStatus,
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import { audit } from "../utils/audit";
import { parsePagination } from "../utils/query";

const router = Router();

const ROUND_STATUSES = Object.values(RoundStatus);
const FINAL_STATUSES = Object.values(ApplicationStatus);

/**
 * POST /api/crm/applications — create an application (student applies to an
 * opportunity). Uniqueness enforced by schema (studentId + opportunityId).
 */
router.post(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    body("studentId").isString().notEmpty().withMessage("studentId is required"),
    body("opportunityId").isString().notEmpty().withMessage("opportunityId is required"),
    body("oaStatus")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`oaStatus must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("gdStatus")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`gdStatus must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("technicalRound")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`technicalRound must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("hrRound")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`hrRound must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("finalStatus")
      .optional()
      .isIn(FINAL_STATUSES)
      .withMessage(`finalStatus must be one of: ${FINAL_STATUSES.join(", ")}`),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { studentId, opportunityId, oaStatus, gdStatus, technicalRound, hrRound, finalStatus, remarks } = req.body;

      const [student, opportunity] = await Promise.all([
        prisma.student.findUnique({ where: { id: studentId } }),
        prisma.opportunity.findUnique({ where: { id: opportunityId } }),
      ]);
      if (!student) throw new NotFoundError("Student not found");
      if (!opportunity) throw new NotFoundError("Opportunity not found");

      const existing = await prisma.application.findUnique({
        where: { studentId_opportunityId: { studentId, opportunityId } },
      });
      if (existing) {
        throw new BadRequestError("This student has already applied to this opportunity");
      }

      const application = await prisma.application.create({
        data: {
          studentId,
          opportunityId,
          applied: true,
          oaStatus: oaStatus ?? RoundStatus.NOT_ATTEMPTED,
          gdStatus: gdStatus ?? RoundStatus.NOT_ATTEMPTED,
          technicalRound: technicalRound ?? RoundStatus.NOT_ATTEMPTED,
          hrRound: hrRound ?? RoundStatus.NOT_ATTEMPTED,
          finalStatus: finalStatus ?? ApplicationStatus.APPLIED,
          remarks,
        },
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "CREATE",
        entity: "applications",
        entityId: application.id,
        changes: { studentId, opportunityId },
      });

      res.status(201).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/applications — list with filters + pagination */
router.get(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    query("search").optional().isString(),
    query("finalStatus")
      .optional()
      .isIn(FINAL_STATUSES)
      .withMessage(`finalStatus must be one of: ${FINAL_STATUSES.join(", ")}`),
    query("opportunityId").optional().isString(),
    query("studentId").optional().isString(),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = {};
      if (req.query.search) {
        const term = String(req.query.search);
        where.student = {
          is: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { registrationNo: { contains: term, mode: "insensitive" } },
            ],
          },
        };
      }
      if (req.query.finalStatus) where.finalStatus = req.query.finalStatus;
      if (req.query.opportunityId) where.opportunityId = req.query.opportunityId;
      if (req.query.studentId) where.studentId = req.query.studentId;

      const [items, total] = await Promise.all([
        prisma.application.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            student: {
              select: {
                id: true,
                registrationNo: true,
                name: true,
                branch: true,
                batch: true,
                cgpa: true,
              },
            },
            opportunity: {
              include: {
                company: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.application.count({ where }),
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

/** GET /api/crm/applications/:id */
router.get(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid application ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const application = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: {
          student: true,
          opportunity: { include: { company: true, coordinator: true } },
        },
      });
      if (!application) throw new NotFoundError("Application not found");
      res.status(200).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/crm/applications/:id — update the pipeline
 * (round statuses, offer released, final status, remarks).
 */
router.patch(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid application ID is required"),
    body("oaStatus")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`oaStatus must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("gdStatus")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`gdStatus must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("technicalRound")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`technicalRound must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("hrRound")
      .optional()
      .isIn(ROUND_STATUSES)
      .withMessage(`hrRound must be one of: ${ROUND_STATUSES.join(", ")}`),
    body("finalStatus")
      .optional()
      .isIn(FINAL_STATUSES)
      .withMessage(`finalStatus must be one of: ${FINAL_STATUSES.join(", ")}`),
    body("applied").optional().isBoolean().withMessage("applied must be a boolean"),
    body("applicationVerified").optional().isBoolean().withMessage("applicationVerified must be a boolean"),
    body("offerReleased").optional().isBoolean().withMessage("offerReleased must be a boolean"),
    body("remarks").optional().isString().withMessage("remarks must be a string"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Application not found");

      const allowed = [
        "applied",
        "applicationVerified",
        "oaStatus",
        "gdStatus",
        "technicalRound",
        "hrRound",
        "offerReleased",
        "finalStatus",
        "remarks",
      ] as const;

      const data: Record<string, unknown> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }

      const application = await prisma.application.update({
        where: { id: existing.id },
        data,
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "applications",
        entityId: application.id,
        changes: data as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }
);

/** DELETE /api/crm/applications/:id */
router.delete(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid application ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Application not found");

      await prisma.application.delete({ where: { id: existing.id } });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "DELETE",
        entity: "applications",
        entityId: existing.id,
      });

      res.status(200).json({ success: true, message: "Application deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as applicationsRouter };
