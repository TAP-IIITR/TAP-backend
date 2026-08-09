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
  Branch,
  OpportunityType,
  EmploymentType,
  OpportunityStatus,
  Prisma,
} from "@prisma/client";
import { audit } from "../utils/audit";
import { parsePagination, searchFilter } from "../utils/query";

const router = Router();

/** POST /api/crm/opportunities — create an opportunity (job posting) */
router.post(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    body("companyId").isString().notEmpty().withMessage("companyId is required"),
    body("academicYear").notEmpty().withMessage("academicYear is required (e.g. 2026-27)"),
    body("opportunityType")
      .isIn(Object.values(OpportunityType))
      .withMessage(`opportunityType must be one of: ${Object.values(OpportunityType).join(", ")}`),
    body("employmentType")
      .isIn(Object.values(EmploymentType))
      .withMessage(`employmentType must be one of: ${Object.values(EmploymentType).join(", ")}`),
    body("role").notEmpty().withMessage("Role is required"),
    body("ctcLpa").optional().isFloat({ min: 0 }).withMessage("ctcLpa must be a number ≥ 0"),
    body("stipendMonthly").optional().isFloat({ min: 0 }).withMessage("stipendMonthly must be a number ≥ 0"),
    body("eligibleBranches").optional().isArray().withMessage("eligibleBranches must be an array"),
    body("minCgpa").optional().isFloat({ min: 0, max: 10 }).withMessage("minCgpa must be 0–10"),
    body("status")
      .optional()
      .isIn(Object.values(OpportunityStatus))
      .withMessage(`status must be one of: ${Object.values(OpportunityStatus).join(", ")}`),
    body("registrationDeadline").optional().isISO8601().withMessage("registrationDeadline must be a valid date"),
    body("driveDate").optional().isISO8601().withMessage("driveDate must be a valid date"),
    body("oaDate").optional().isISO8601().withMessage("oaDate must be a valid date"),
    body("interviewDate").optional().isISO8601().withMessage("interviewDate must be a valid date"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        companyId,
        academicYear,
        opportunityType,
        employmentType,
        role,
        ctcLpa,
        stipendMonthly,
        eligibleBranches,
        minCgpa,
        registrationDeadline,
        applicationLink,
        portal,
        driveDate,
        oaDate,
        interviewDate,
        venue,
        coordinatorId,
        status,
        jdUrl,
      } = req.body;

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundError("Company not found");

      if (coordinatorId) {
        const coord = await prisma.coordinator.findUnique({
          where: { id: String(coordinatorId) },
        });
        if (!coord) throw new NotFoundError("Assigned coordinator not found");
      }

      if (eligibleBranches) {
        const invalid = eligibleBranches.filter(
          (b: string) => !Object.values(Branch).includes(b as Branch)
        );
        if (invalid.length > 0) {
          throw new BadRequestError(`Invalid branch(es): ${invalid.join(", ")}`);
        }
      }

      const opportunity = await prisma.opportunity.create({
        data: {
          companyId,
          academicYear,
          opportunityType,
          employmentType,
          role,
          ctcLpa: ctcLpa === undefined || ctcLpa === null ? null : Number(ctcLpa),
          stipendMonthly:
            stipendMonthly === undefined || stipendMonthly === null
              ? null
              : Number(stipendMonthly),
          eligibleBranches: eligibleBranches ?? [],
          minCgpa: minCgpa === undefined || minCgpa === null ? null : Number(minCgpa),
          registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
          applicationLink,
          portal,
          driveDate: driveDate ? new Date(driveDate) : null,
          oaDate: oaDate ? new Date(oaDate) : null,
          interviewDate: interviewDate ? new Date(interviewDate) : null,
          venue,
          coordinatorId: coordinatorId ?? null,
          status: status ?? OpportunityStatus.OPEN,
          jdUrl,
        },
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "CREATE",
        entity: "opportunities",
        entityId: opportunity.id,
        changes: { role, companyId, academicYear },
      });

      res.status(201).json({ success: true, data: opportunity });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/opportunities — list with filters + pagination */
router.get(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    query("search").optional().isString(),
    query("academicYear").optional().isString(),
    query("status")
      .optional()
      .isIn(Object.values(OpportunityStatus))
      .withMessage(`status must be one of: ${Object.values(OpportunityStatus).join(", ")}`),
    query("employmentType")
      .optional()
      .isIn(Object.values(EmploymentType))
      .withMessage(`employmentType must be one of: ${Object.values(EmploymentType).join(", ")}`),
    query("companyId").optional().isString(),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = {};
      const search = searchFilter(req.query.search);
      if (search) where.role = search;
      if (req.query.academicYear) where.academicYear = req.query.academicYear;
      if (req.query.status) where.status = req.query.status;
      if (req.query.employmentType) where.employmentType = req.query.employmentType;
      if (req.query.companyId) where.companyId = req.query.companyId;

      const [items, total] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            company: { select: { id: true, name: true, sector: true } },
            coordinator: { select: { id: true, name: true } },
            _count: { select: { applications: true, offers: true } },
          },
        }),
        prisma.opportunity.count({ where }),
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

/** GET /api/crm/opportunities/:id */
router.get(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid opportunity ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: req.params.id },
        include: {
          company: true,
          coordinator: { select: { id: true, name: true, email: true } },
          applications: {
            orderBy: { createdAt: "desc" },
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
            },
          },
          offers: {
            include: {
              student: { select: { id: true, registrationNo: true, name: true } },
            },
          },
        },
      });
      if (!opportunity) throw new NotFoundError("Opportunity not found");
      res.status(200).json({ success: true, data: opportunity });
    } catch (error) {
      next(error);
    }
  }
);

/** PATCH /api/crm/opportunities/:id */
router.patch(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid opportunity ID is required"),
    body("status")
      .optional()
      .isIn(Object.values(OpportunityStatus))
      .withMessage(`status must be one of: ${Object.values(OpportunityStatus).join(", ")}`),
    body("opportunityType")
      .optional()
      .isIn(Object.values(OpportunityType))
      .withMessage(`opportunityType must be one of: ${Object.values(OpportunityType).join(", ")}`),
    body("employmentType")
      .optional()
      .isIn(Object.values(EmploymentType))
      .withMessage(`employmentType must be one of: ${Object.values(EmploymentType).join(", ")}`),
    body("ctcLpa").optional().isFloat({ min: 0 }).withMessage("ctcLpa must be a number ≥ 0"),
    body("stipendMonthly").optional().isFloat({ min: 0 }).withMessage("stipendMonthly must be a number ≥ 0"),
    body("minCgpa").optional().isFloat({ min: 0, max: 10 }).withMessage("minCgpa must be 0–10"),
    body("role").optional().isString().withMessage("role must be a string"),
    body("academicYear").optional().isString().withMessage("academicYear must be a string"),
    body("venue").optional().isString().withMessage("venue must be a string"),
    body("portal").optional().isString().withMessage("portal must be a string"),
    body("applicationLink").optional().isString().withMessage("applicationLink must be a string"),
    body("jdUrl").optional().isString().withMessage("jdUrl must be a string"),
    body("coordinatorId").optional().isString().withMessage("coordinatorId must be a string"),
    body("registrationDeadline").optional().isISO8601().withMessage("registrationDeadline must be a valid date"),
    body("driveDate").optional().isISO8601().withMessage("driveDate must be a valid date"),
    body("oaDate").optional().isISO8601().withMessage("oaDate must be a valid date"),
    body("interviewDate").optional().isISO8601().withMessage("interviewDate must be a valid date"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Opportunity not found");

      const allowed = [
        "academicYear",
        "opportunityType",
        "employmentType",
        "role",
        "ctcLpa",
        "stipendMonthly",
        "eligibleBranches",
        "minCgpa",
        "registrationDeadline",
        "applicationLink",
        "portal",
        "driveDate",
        "oaDate",
        "interviewDate",
        "venue",
        "coordinatorId",
        "status",
        "jdUrl",
      ] as const;

      const data: Record<string, unknown> = {};
      for (const key of allowed) {
        if (req.body[key] === undefined) continue;
        const v = req.body[key];
        // Decimal + date coercion
        if (key === "ctcLpa" || key === "stipendMonthly" || key === "minCgpa") {
          data[key] = v === null ? null : Number(v);
        } else if (["registrationDeadline", "driveDate", "oaDate", "interviewDate"].includes(key)) {
          data[key] = v === null ? null : new Date(v);
        } else if (key === "eligibleBranches") {
          const invalid = (v as string[]).filter(
            (b) => !Object.values(Branch).includes(b as Branch)
          );
          if (invalid.length > 0) {
            throw new BadRequestError(`Invalid branch(es): ${invalid.join(", ")}`);
          }
          data[key] = v;
        } else {
          data[key] = v;
        }
      }

      if (data.role === "") throw new BadRequestError("Role cannot be empty");
      if (data.coordinatorId) {
        const coord = await prisma.coordinator.findUnique({
          where: { id: String(data.coordinatorId) },
        });
        if (!coord) throw new NotFoundError("Assigned coordinator not found");
      }

      const opportunity = await prisma.opportunity.update({
        where: { id: existing.id },
        data,
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "opportunities",
        entityId: opportunity.id,
        changes: data as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: opportunity });
    } catch (error) {
      next(error);
    }
  }
);

/** DELETE /api/crm/opportunities/:id */
router.delete(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid opportunity ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.opportunity.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { applications: true, offers: true } } },
      });
      if (!existing) throw new NotFoundError("Opportunity not found");
      if (existing._count.applications > 0 || existing._count.offers > 0) {
        throw new BadRequestError(
          "Cannot delete an opportunity that has applications or offers. Close it instead."
        );
      }

      await prisma.opportunity.delete({ where: { id: existing.id } });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "DELETE",
        entity: "opportunities",
        entityId: existing.id,
      });

      res.status(200).json({ success: true, message: "Opportunity deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as opportunitiesRouter };
