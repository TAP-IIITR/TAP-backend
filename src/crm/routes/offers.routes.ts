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
import { UserRole, OfferStatus, Prisma } from "@prisma/client";
import { audit } from "../utils/audit";
import { parsePagination } from "../utils/query";

const router = Router();

/** POST /api/crm/offers — record an offer */
router.post(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    body("studentId").isString().notEmpty().withMessage("studentId is required"),
    body("opportunityId").isString().notEmpty().withMessage("opportunityId is required"),
    body("finalCtcLpa").optional().isFloat({ min: 0 }).withMessage("finalCtcLpa must be a number ≥ 0"),
    body("accepted")
      .optional()
      .isIn(Object.values(OfferStatus))
      .withMessage(`accepted must be one of: ${Object.values(OfferStatus).join(", ")}`),
    body("offerDate").optional().isISO8601().withMessage("offerDate must be a valid date"),
    body("joiningDate").optional().isISO8601().withMessage("joiningDate must be a valid date"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { studentId, opportunityId, finalCtcLpa, accepted, offerDate, joiningDate, remarks } = req.body;

      const [student, opportunity] = await Promise.all([
        prisma.student.findUnique({ where: { id: studentId } }),
        prisma.opportunity.findUnique({ where: { id: opportunityId } }),
      ]);
      if (!student) throw new NotFoundError("Student not found");
      if (!opportunity) throw new NotFoundError("Opportunity not found");

      const existing = await prisma.offer.findUnique({
        where: { studentId_opportunityId: { studentId, opportunityId } },
      });
      if (existing) {
        throw new BadRequestError("An offer for this student + opportunity already exists");
      }

      const offer = await prisma.offer.create({
        data: {
          studentId,
          opportunityId,
          finalCtcLpa: finalCtcLpa === undefined || finalCtcLpa === null ? null : Number(finalCtcLpa),
          accepted: accepted ?? OfferStatus.ACCEPTED,
          offerDate: offerDate ? new Date(offerDate) : null,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          remarks,
        },
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "CREATE",
        entity: "offers",
        entityId: offer.id,
        changes: { studentId, opportunityId },
      });

      res.status(201).json({ success: true, data: offer });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/offers — list with filters + pagination */
router.get(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    query("opportunityId").optional().isString(),
    query("studentId").optional().isString(),
    query("accepted")
      .optional()
      .isIn(Object.values(OfferStatus))
      .withMessage(`accepted must be one of: ${Object.values(OfferStatus).join(", ")}`),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = {};
      if (req.query.opportunityId) where.opportunityId = req.query.opportunityId;
      if (req.query.studentId) where.studentId = req.query.studentId;
      if (req.query.accepted) where.accepted = req.query.accepted;

      const [items, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            student: {
              select: { id: true, registrationNo: true, name: true, branch: true, batch: true },
            },
            opportunity: {
              include: {
                company: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.offer.count({ where }),
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

/** GET /api/crm/offers/:id */
router.get(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid offer ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const offer = await prisma.offer.findUnique({
        where: { id: req.params.id },
        include: {
          student: true,
          opportunity: { include: { company: true } },
        },
      });
      if (!offer) throw new NotFoundError("Offer not found");
      res.status(200).json({ success: true, data: offer });
    } catch (error) {
      next(error);
    }
  }
);

/** PATCH /api/crm/offers/:id */
router.patch(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid offer ID is required"),
    body("finalCtcLpa").optional().isFloat({ min: 0 }).withMessage("finalCtcLpa must be a number ≥ 0"),
    body("accepted")
      .optional()
      .isIn(Object.values(OfferStatus))
      .withMessage(`accepted must be one of: ${Object.values(OfferStatus).join(", ")}`),
    body("offerDate").optional().isISO8601().withMessage("offerDate must be a valid date"),
    body("joiningDate").optional().isISO8601().withMessage("joiningDate must be a valid date"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Offer not found");

      const allowed = ["finalCtcLpa", "accepted", "offerDate", "joiningDate", "remarks"] as const;
      const data: Record<string, unknown> = {};
      for (const key of allowed) {
        if (req.body[key] === undefined) continue;
        const v = req.body[key];
        if (key === "finalCtcLpa") data[key] = v === null ? null : Number(v);
        else if (key === "offerDate" || key === "joiningDate") data[key] = v === null ? null : new Date(v);
        else data[key] = v;
      }

      const offer = await prisma.offer.update({ where: { id: existing.id }, data });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "offers",
        entityId: offer.id,
        changes: data as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: offer });
    } catch (error) {
      next(error);
    }
  }
);

/** DELETE /api/crm/offers/:id */
router.delete(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid offer ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Offer not found");

      await prisma.offer.delete({ where: { id: existing.id } });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "DELETE",
        entity: "offers",
        entityId: existing.id,
      });

      res.status(200).json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as offersRouter };
