import { Router } from "express";
import { param } from "express-validator";
import multer from "multer";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  requireRole,
  AuthenticatedRequest,
} from "../../auth/middleware/requireRole";
import { prisma } from "../../config/prisma";
import { supabaseAdmin } from "../../config/supabase";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { UserRole, OpportunityStatus, ApplicationStatus } from "@prisma/client";
import { audit } from "../../crm/utils/audit";
import { renderResumeHtml } from "../services/resume-renderer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (PDF resumes)
});

/** Resolve the registered Student row for the authenticated Supabase user. */
const getStudent = async (req: AuthenticatedRequest) => {
  const student = await prisma.student.findUnique({
    where: { authUid: req.user!.id },
  });
  if (!student) {
    throw new NotFoundError(
      "Student record not found. Contact the TAP cell to register your account."
    );
  }
  return student;
};

/**
 * GET /api/student/me — the student's own profile (with status + counts).
 */
router.get("/me", requireRole(UserRole.STUDENT), async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const [status, applicationCount, offerCount] = await Promise.all([
      prisma.studentStatus.findUnique({ where: { studentId: student.id } }),
      prisma.application.count({ where: { studentId: student.id } }),
      prisma.offer.count({ where: { studentId: student.id } }),
    ]);
    res.status(200).json({
      success: true,
      data: { ...student, cgpa: student.cgpa?.toString() ?? null, status, applicationCount, offerCount },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/student/opportunities — open opportunities the student is
 * eligible for (branch in eligibleBranches, or all-branch postings),
 * excluding expired registration deadlines.
 */
router.get(
  "/opportunities",
  requireRole(UserRole.STUDENT),
  async (req, res, next) => {
    try {
      const student = await getStudent(req);
      const now = new Date();

      const opportunities = await prisma.opportunity.findMany({
        where: {
          status: OpportunityStatus.OPEN,
          AND: [
            {
              OR: [
                { eligibleBranches: { isEmpty: true } },
                { eligibleBranches: { has: student.branch } },
              ],
            },
            {
              OR: [
                { registrationDeadline: null },
                { registrationDeadline: { gte: now } },
              ],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true, sector: true } },
          _count: { select: { applications: true } },
        },
      });

      // Serialize Decimal fields for consistent JSON output.
      const data = opportunities.map((o) => ({
        ...o,
        ctcLpa: o.ctcLpa?.toString() ?? null,
        stipendMonthly: o.stipendMonthly?.toString() ?? null,
        minCgpa: o.minCgpa?.toString() ?? null,
      }));

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/student/opportunities/:id — detail incl. hasApplied + own profile
 * (for the prefilled, read-only application info).
 */
router.get(
  "/opportunities/:id",
  requireRole(UserRole.STUDENT),
  [param("id").isString().withMessage("Valid opportunity ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const student = await getStudent(req);
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: req.params.id },
        include: {
          company: true,
          coordinator: { select: { id: true, name: true, email: true } },
        },
      });
      if (!opportunity) throw new NotFoundError("Opportunity not found");

      const application = await prisma.application.findUnique({
        where: {
          studentId_opportunityId: { studentId: student.id, opportunityId: opportunity.id },
        },
      });

      res.status(200).json({
        success: true,
        data: {
          ...opportunity,
          ctcLpa: opportunity.ctcLpa?.toString() ?? null,
          stipendMonthly: opportunity.stipendMonthly?.toString() ?? null,
          minCgpa: opportunity.minCgpa?.toString() ?? null,
          hasApplied: !!application,
          student: {
            name: student.name,
            registrationNo: student.registrationNo,
            collegeEmail: student.collegeEmail,
            mobile: student.mobile,
            cgpa: student.cgpa?.toString() ?? null,
            branch: student.branch,
            batch: student.batch,
            resumeUrl: student.resumeUrl,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/student/opportunities/:id/apply — create an application.
 * Duplicate applications are rejected by the unique constraint.
 */
router.post(
  "/opportunities/:id/apply",
  requireRole(UserRole.STUDENT),
  [param("id").isString().withMessage("Valid opportunity ID is required")],
  validateRequest,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const student = await getStudent(req);
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: req.params.id },
      });
      if (!opportunity) throw new NotFoundError("Opportunity not found");
      if (opportunity.status !== OpportunityStatus.OPEN) {
        throw new BadRequestError("This opportunity is no longer open for applications");
      }
      if (
        opportunity.registrationDeadline &&
        opportunity.registrationDeadline < new Date()
      ) {
        throw new BadRequestError("The registration deadline has passed");
      }

      const existing = await prisma.application.findUnique({
        where: {
          studentId_opportunityId: { studentId: student.id, opportunityId: opportunity.id },
        },
      });
      if (existing) {
        throw new BadRequestError("You have already applied to this opportunity");
      }

      // Enforce minimum CGPA server-side.
      if (opportunity.minCgpa != null && student.cgpa != null) {
        if (Number(student.cgpa) < Number(opportunity.minCgpa)) {
          throw new BadRequestError(
            `Your CGPA (${student.cgpa}) is below the minimum requirement (${opportunity.minCgpa})`
          );
        }
      }

      const application = await prisma.application.create({
        data: {
          studentId: student.id,
          opportunityId: opportunity.id,
          applied: true,
          finalStatus: ApplicationStatus.APPLIED,
        },
      });

      await audit({
        actorId: student.id,
        actorRole: UserRole.STUDENT,
        action: "CREATE",
        entity: "applications",
        entityId: application.id,
        changes: { opportunityId: opportunity.id, source: "student-portal" },
      });

      res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        data: { id: application.id },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/student/applications — the student's own applications
 * (with opportunity + company + round statuses).
 */
router.get(
  "/applications",
  requireRole(UserRole.STUDENT),
  async (req, res, next) => {
    try {
      const student = await getStudent(req);
      const applications = await prisma.application.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        include: {
          opportunity: {
            include: { company: { select: { id: true, name: true } } },
          },
        },
      });
      res.status(200).json({ success: true, data: applications });
    } catch (error) {
      next(error);
    }
  }
);

/** Ensure the public "resumes" bucket exists (idempotent). */
const ensureResumeBucket = async () => {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "resumes")) {
    const { error } = await supabaseAdmin.storage.createBucket("resumes", { public: true });
    // Tolerate concurrent creation races (bucket already exists).
    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw error;
    }
  }
};

/**
 * POST /api/student/resume — upload a PDF resume to Supabase Storage
 * and update the student's resumeUrl.
 */
router.post(
  "/resume",
  requireRole(UserRole.STUDENT),
  upload.single("resume"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const student = await getStudent(req);
      if (!req.file) throw new BadRequestError("resume (PDF) file is required");
      if (req.file.mimetype !== "application/pdf") {
        throw new BadRequestError("Only PDF files are allowed");
      }
      // Verify actual PDF magic bytes — never trust the client's Content-Type.
      if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new BadRequestError("Uploaded file is not a valid PDF");
      }

      await ensureResumeBucket();
      const path = `${student.id}/resume-${Date.now()}.pdf`;
      const { error } = await supabaseAdmin.storage
        .from("resumes")
        .upload(path, req.file.buffer, { contentType: "application/pdf", upsert: true });
      if (error) throw new BadRequestError("Failed to upload resume: " + error.message);

      const { data: pub } = supabaseAdmin.storage.from("resumes").getPublicUrl(path);
      await prisma.student.update({
        where: { id: student.id },
        data: { resumeUrl: pub.publicUrl },
      });

      await audit({
        actorId: student.id,
        actorRole: UserRole.STUDENT,
        action: "UPDATE",
        entity: "students",
        entityId: student.id,
        changes: { resume: "uploaded" },
      });

      res.status(200).json({ success: true, message: "Resume uploaded", data: { url: pub.publicUrl } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/student/resume/preview — returns an HTML resume the student
 * can open in a new tab and print to PDF.
 */
router.post("/resume/preview", requireRole(UserRole.STUDENT), async (req, res, next) => {
  try {
    await getStudent(req);
    const { resumeData, template } = req.body || {};
    if (!resumeData) throw new BadRequestError("resumeData is required");
    const html = renderResumeHtml(resumeData, template || "classic");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/student/resume/generate — renders the HTML resume, stores it in
 * Supabase Storage, and sets it as the student's resumeUrl.
 */
router.post("/resume/generate", requireRole(UserRole.STUDENT), async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const { resumeData, template } = req.body || {};
    if (!resumeData) throw new BadRequestError("resumeData is required");

    const html = renderResumeHtml(resumeData, template || "classic");
    await ensureResumeBucket();
    const path = `${student.id}/resume-${Date.now()}.html`;
    const { error } = await supabaseAdmin.storage
      .from("resumes")
      .upload(path, Buffer.from(html, "utf-8"), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });
    if (error) throw new BadRequestError("Failed to save resume: " + error.message);

    const { data: pub } = supabaseAdmin.storage.from("resumes").getPublicUrl(path);
    await prisma.student.update({
      where: { id: student.id },
      data: { resumeUrl: pub.publicUrl },
    });

    await audit({
      actorId: student.id,
      actorRole: UserRole.STUDENT,
      action: "UPDATE",
      entity: "students",
      entityId: student.id,
      changes: { resume: "generated" },
    });

    res.status(200).json({ success: true, message: "Resume saved", data: { url: pub.publicUrl } });
  } catch (error) {
    next(error);
  }
});

export { router as studentRouter };
