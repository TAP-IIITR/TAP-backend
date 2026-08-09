import { Router } from "express";
import { requireRole } from "../../auth/middleware/requireRole";
import { prisma } from "../../config/prisma";
import { UserRole, PlacementStatus } from "@prisma/client";

const router = Router();

/**
 * GET /api/crm/dashboard/stats
 * Summary cards + funnel for the coordinator home screen.
 */
router.get(
  "/stats",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  async (_req, res, next) => {
    try {
      const [
        totalStudents,
        placedStudents,
        unplacedEligible,
        higherStudies,
        governmentExams,
        totalCompanies,
        totalOpportunities,
        activeOpportunities,
        totalApplications,
        selectedApplications,
        totalOffers,
        acceptedOffers,
      ] = await Promise.all([
        prisma.student.count(),
        prisma.studentStatus.count({
          where: { currentPlacementStatus: PlacementStatus.PLACED },
        }),
        prisma.studentStatus.count({
          where: {
            currentPlacementStatus: PlacementStatus.UNPLACED,
            placementEligible: true,
          },
        }),
        prisma.studentStatus.count({ where: { higherStudies: true } }),
        prisma.studentStatus.count({ where: { governmentExams: true } }),
        prisma.company.count(),
        prisma.opportunity.count(),
        prisma.opportunity.count({ where: { status: "OPEN" } }),
        prisma.application.count(),
        prisma.application.count({ where: { finalStatus: "SELECTED" } }),
        prisma.offer.count(),
        prisma.offer.count({ where: { accepted: "ACCEPTED" } }),
      ]);

      let placementStats: Array<Record<string, unknown>> = [];
      let funnel: Record<string, unknown> = {};
      try {
        const [ps, fn] = await Promise.all([
          prisma.$queryRaw<
            Array<Record<string, unknown>>
          >`SELECT * FROM v_placement_stats ORDER BY "academicYear" DESC`,
          prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM v_placement_funnel`,
        ]);
        placementStats = ps;
        funnel = fn[0] ?? {};
      } catch {
        // Report views may not be initialized (views.sql not applied).
        // Stats cards still work; report views return empty instead of 500.
      }

      const toNum = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

      res.status(200).json({
        success: true,
        data: {
          totals: {
            totalStudents,
            placedStudents,
            unplacedEligible,
            higherStudies,
            governmentExams,
            totalCompanies,
            totalOpportunities,
            activeOpportunities,
            totalApplications,
            selectedApplications,
            totalOffers,
            acceptedOffers,
          },
          placementStats: placementStats.map((r) => ({
            branch: r.branch as string,
            academicYear: toNum(r.academicYear),
            totalStudents: toNum(r.totalStudents),
            eligible: toNum(r.eligible),
            placed: toNum(r.placed),
            higherStudies: toNum(r.higherStudies),
            governmentExams: toNum(r.governmentExams),
          })),
          funnel,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/crm/dashboard/reports/:view
 * Exposes the precomputed report views:
 *  placement-stats | placement-funnel | company-report | package-stats |
 *  student-report | unplaced-students | higher-studies | government-exams
 */
router.get(
  "/reports/:view",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  async (req, res, next) => {
    try {
      const view = req.params.view;
      const allowed: Record<string, string> = {
        "placement-stats": "v_placement_stats",
        "placement-funnel": "v_placement_funnel",
        "company-report": "v_company_report",
        "package-stats": "v_package_stats",
        "student-report": "v_student_report",
        "unplaced-students": "v_unplaced_students",
        "higher-studies": "v_higher_studies",
        "government-exams": "v_government_exams",
      };

      const table = allowed[view];
      if (!table) {
        res.status(400).json({ success: false, message: "Unknown report view" });
        return;
      }

      try {
        // Whitelisted view names only — safe from SQL injection.
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${table}`);
        res.status(200).json({ success: true, data: rows });
      } catch {
        res.status(503).json({
          success: false,
          message: "Report views not initialized. Run prisma/views.sql first.",
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/** GET /api/crm/dashboard/package-stats — quick alias for the package report */
router.get(
  "/package-stats",
  requireRole(UserRole.TPO, UserRole.COORDINATOR),
  async (_req, res, next) => {
    try {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT "academicYear", "highestCtcLpa", "avgCtcLpa", "lowestCtcLpa", "medianCtcLpa"
           FROM v_package_stats ORDER BY "academicYear" DESC`
        );
        res.status(200).json({ success: true, data: rows });
      } catch {
        res.status(503).json({
          success: false,
          message: "Report views not initialized. Run prisma/views.sql first.",
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export { router as dashboardRouter };
