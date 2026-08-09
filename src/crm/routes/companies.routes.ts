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
import { UserRole, Sector, Prisma } from "@prisma/client";
import { audit } from "../utils/audit";
import { parsePagination, searchFilter } from "../utils/query";

const router = Router();

/** POST /api/crm/companies — create a company */
router.post(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    body("name").notEmpty().withMessage("Company name is required"),
    body("sector")
      .optional()
      .isIn(Object.values(Sector))
      .withMessage(`Sector must be one of: ${Object.values(Sector).join(", ")}`),
    body("website").optional().isURL().withMessage("Website must be a valid URL"),
    body("hrEmail").optional().isEmail().withMessage("HR email must be a valid email"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, sector, website, hrName, hrEmail, hrPhone, notes } = req.body;

      const existing = await prisma.company.findUnique({ where: { name } });
      if (existing) {
        throw new BadRequestError("A company with this name already exists");
      }

      const company = await prisma.company.create({
        data: { name, sector, website, hrName, hrEmail, hrPhone, notes },
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "CREATE",
        entity: "companies",
        entityId: company.id,
        changes: { name },
      });

      res.status(201).json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/companies?search=&sector=&page=&limit= */
router.get(
  "/",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    query("search").optional().isString(),
    query("sector")
      .optional()
      .isIn(Object.values(Sector))
      .withMessage(`Sector must be one of: ${Object.values(Sector).join(", ")}`),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = {};
      const nameFilter = searchFilter(req.query.search);
      if (nameFilter) where.name = nameFilter;
      if (req.query.sector) where.sector = req.query.sector;

      const [items, total] = await Promise.all([
        prisma.company.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: { _count: { select: { opportunities: true } } },
        }),
        prisma.company.count({ where }),
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

/** GET /api/crm/companies/:id */
router.get(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid company ID is required")],
  validateRequest,
  async (req, res, next) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: {
          opportunities: {
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { applications: true, offers: true } } },
          },
        },
      });
      if (!company) throw new NotFoundError("Company not found");
      res.status(200).json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  }
);

/** PATCH /api/crm/companies/:id */
router.patch(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [
    param("id").isString().withMessage("Valid company ID is required"),
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("sector")
      .optional()
      .isIn(Object.values(Sector))
      .withMessage(`Sector must be one of: ${Object.values(Sector).join(", ")}`),
    body("website").optional().isURL().withMessage("Website must be a valid URL"),
    body("hrEmail").optional().isEmail().withMessage("HR email must be a valid email"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError("Company not found");

      const { name, sector, website, hrName, hrEmail, hrPhone, notes } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (sector !== undefined) data.sector = sector;
      if (website !== undefined) data.website = website;
      if (hrName !== undefined) data.hrName = hrName;
      if (hrEmail !== undefined) data.hrEmail = hrEmail;
      if (hrPhone !== undefined) data.hrPhone = hrPhone;
      if (notes !== undefined) data.notes = notes;

      if (data.name && data.name !== existing.name) {
        const dup = await prisma.company.findUnique({ where: { name: String(data.name) } });
        if (dup) throw new BadRequestError("A company with this name already exists");
      }

      const company = await prisma.company.update({
        where: { id: existing.id },
        data,
      });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "UPDATE",
        entity: "companies",
        entityId: company.id,
        changes: data as Prisma.InputJsonValue,
      });

      res.status(200).json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  }
);

/** DELETE /api/crm/companies/:id */
router.delete(
  "/:id",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  [param("id").isString().withMessage("Valid company ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { opportunities: true } } },
      });
      if (!company) throw new NotFoundError("Company not found");
      if (company._count.opportunities > 0) {
        throw new BadRequestError(
          "Cannot delete a company that has opportunities. Delete or reassign its opportunities first."
        );
      }

      await prisma.company.delete({ where: { id: company.id } });

      await audit({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: "DELETE",
        entity: "companies",
        entityId: company.id,
      });

      res.status(200).json({ success: true, message: "Company deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export { router as companiesRouter };
