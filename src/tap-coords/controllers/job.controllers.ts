import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  query,
  where,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler, NextFunction } from "express";
import { db } from "../../config/firebase";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { v4 as uuidv4 } from "uuid";

export const createJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const {
      title,
      JD,
      location,
      package: salaryPackage,
      eligibility,
      eligibleBatches,
      deadline,
      form,
      company,
      jobType,
      recruiter,
    } = req.body;

    if (
      !title ||
      !JD ||
      !location ||
      !salaryPackage ||
      !eligibility ||
      !eligibleBatches ||
      !deadline ||
      !form ||
      !company ||
      !jobType
    ) {
      throw new BadRequestError(
        "Missing required fields: title, JD, location, package, eligibility, eligibleBatches, deadline, form, company, and jobType are required"
      );
    }

    let recruiterId = null;
    if (recruiter) {
      const recruiterRef = doc(db, "recruiters", recruiter);
      const recruiterDoc = await getDoc(recruiterRef);
      if (!recruiterDoc.exists()) {
        throw new NotFoundError("Recruiter not found");
      }
      recruiterId = recruiter;
    }

    const jobId = uuidv4();
    const newJob = {
      id: jobId,
      title,
      JD,
      location,
      package: salaryPackage,
      eligibility,
      eligibleBatches,
      deadline: new Date(deadline).toISOString(),
      form,
      company,
      jobType, // Add jobType to the job document
      recruiter: recruiterId,
      createdBy: req.user.id,
      applications: [],
      status: "pending_verification", // Start as pending verification
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, "jobs"), newJob);

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: { jobId },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllJobs: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as "asc" | "desc" | undefined;

    let jobsQuery = query(
      collection(db, "jobs"),
      where("createdBy", "==", req.user.id)
    );
    if (sortBy) {
      const field = sortBy === "postedTime" ? "createdAt" : "package";
      jobsQuery = query(jobsQuery, orderBy(field, sortOrder || "desc"));
    }

    const jobsSnap = await getDocs(jobsQuery);
    let jobs = await Promise.all(
      jobsSnap.docs.map(async (doc) => {
        const jobData = doc.data();
        let company = jobData.company || "Unknown Company";
        if (jobData.recruiter) {
          company = await getRecruiterCompanyName(jobData.recruiter);
        }

        return {
          id: doc.id,
          title: jobData.title,
          company,
          location: jobData.location,
          jobType: jobData.jobType,
          package: jobData.package,
          createdAt: (jobData.createdAt as Timestamp)?.toDate().toISOString(),
          status: jobData.status,
          applications: jobData.applications || [],
        };
      })
    );

    if (search) {
      const searchLower = search.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.title.toLowerCase().includes(searchLower) ||
          job.company.toLowerCase().includes(searchLower)
      );
    }

    if (limit) {
      jobs = jobs.slice(0, limit);
    }

    res.status(200).json({
      success: true,
      message: "Jobs retrieved successfully",
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.params.id;
    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();
    // console.log("jobData", jobData);
    // console.log("jobData", jobData);
    let allApplications = [];
    for (const application of jobData.applications) {
      // console.log("application", application);
      const applicationRef = collection(db, "jobApplications");
      const q = query(applicationRef, where("id", "==", application.id));
      const applicationSnap = await getDocs(q);
      const applicationDoc = applicationSnap.docs[0];
      if (applicationDoc.exists()) {
        allApplications.push(applicationDoc.data());
      }
    }

    let company = jobData.company || "Unknown Company";
    if (jobData.recruiter) {
      company = await getRecruiterCompanyName(jobData.recruiter);
    }

    res.status(200).json({
      success: true,
      message: "Job retrieved successfully",
      data: {
        id: jobDoc.id,
        title: jobData.title,
        JD: jobData.JD,
        location: jobData.location,
        jobType: jobData.jobType || "Full-Time",
        package: jobData.package,
        eligibility: jobData.eligibility,
        eligibleBatches: jobData.eligibleBatches,
        deadline: jobData.deadline,
        form: jobData.form,
        company,
        status: jobData.status,
        applications: allApplications || [],
        createdAt: (jobData.createdAt as Timestamp)?.toDate().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.params.id;
    const updates = { ...req.body, updatedAt: serverTimestamp() };
    delete updates.id;
    delete updates.applications;
    delete updates.createdAt;

    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    await updateDoc(jobRef, updates);

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.params.id;
    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    await updateDoc(jobRef, {
      status: "inactive",
      updatedAt: serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getAllApplications: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("in getallapplications ");
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.query.job as string;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;

    let jobsQuery = query(
      collection(db, "jobs"),
      where("createdBy", "==", req.user.id)
    );
    if (jobId) {
      jobsQuery = query(jobsQuery, where("id", "==", jobId));
    }

    const jobsSnap = await getDocs(jobsQuery);
    let allApplications: any[] = [];

    for (const jobDoc of jobsSnap.docs) {
      const jobData = jobDoc.data();
      const jobApplications = jobData.applications || [];

      const applicationsWithJobDetails = await Promise.all(
        jobApplications.map(async (app: any) => {
          let company = jobData.company || "Unknown Company";
          if (jobData.recruiter) {
            company = await getRecruiterCompanyName(jobData.recruiter);
          }

          return {
            ...app,
            jobId: jobDoc.id,
            jobTitle: jobData.title,
            company,
          };
        })
      );

      allApplications.push(...applicationsWithJobDetails);
    }

    if (allApplications.length === 0) {
      res.status(200).json({
        success: true,
        message: "No applications found",
        data: [],
      });
      return;
    }

    allApplications.sort((a, b) => {
      const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return dateB - dateA;
    });

    if (limit) {
      allApplications = allApplications.slice(0, limit);
    }

    const applicationsWithDetails = await Promise.all(
      allApplications.map(async (app: any) => {
        const studentRef = doc(db, "students", app.student);
        const studentDoc = await getDoc(studentRef);
        const studentData = studentDoc.exists() ? studentDoc.data() : null;

        return {
          ...app,
          student: studentData
            ? {
              id: studentDoc.id,
              name: `${studentData.firstName} ${studentData.lastName}`,
              email: studentData.regEmail,
              cgpa: studentData.cgpa || "N/A",
              mobile: studentData.mobile,
              branch: studentData.branch,
              linkedin: studentData.linkedin,
              batch: studentData.batch,
              rollNumber: studentData.rollNumber,
            }
            : "Student not found",
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Applications retrieved successfully",
      data: applicationsWithDetails,
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingVerifications: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobsRef = collection(db, "jobs");
    const q = query(
      jobsRef,
      where("status", "==", "pending_verification"),
      where("createdBy", "==", req.user.id)
    );
    const jobsSnap = await getDocs(q);

    const pendingJobs = await Promise.all(
      jobsSnap.docs.map(
        async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
          const jobData = docSnapshot.data();
          let company = jobData.company || "Unknown";
          if (jobData.recruiter) {
            const recruiterRef = doc(
              db,
              "recruiters",
              jobData.recruiter as string
            );
            const recruiterDoc = await getDoc(recruiterRef);
            const recruiterData = recruiterDoc.exists()
              ? recruiterDoc.data()
              : null;
            company = recruiterData?.companyName || company;
          }

          return {
            id: docSnapshot.id,
            title: jobData.title,
            company,
            location: jobData.location,
            jobType: jobData.jobType || "Full-Time",
            package: jobData.package,
            createdAt: (jobData.createdAt as Timestamp)?.toDate().toISOString(),
            status: jobData.status,
          };
        }
      )
    );

    res.status(200).json({
      success: true,
      message: "Pending verifications retrieved successfully",
      data: pendingJobs,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.params.id;
    const { action } = req.body;

    if (!jobId || typeof jobId !== "string") {
      throw new BadRequestError("Invalid job ID");
    }
    if (!action || !["approve", "reject"].includes(action)) {
      throw new BadRequestError(
        "Invalid action. Must be 'approve' or 'reject'"
      );
    }

    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();
    if (jobData.status !== "pending_verification") {
      throw new BadRequestError("Job is not pending verification");
    }

    const newStatus = action === "approve" ? "active" : "inactive";
    await updateDoc(jobRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: `Job ${action}ed successfully`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    const jobId = req.params.jobId;
    const studentId = req.params.studentId;
    const { status } = req.body;

    if (!jobId || typeof jobId !== "string") {
      throw new BadRequestError("Invalid job ID");
    }
    if (!studentId || typeof studentId !== "string") {
      throw new BadRequestError("Invalid student ID");
    }
    if (
      !status ||
      !["selected", "rejected", "under_review", "pending"].includes(status)
    ) {
      throw new BadRequestError(
        "Invalid status. Must be 'selected', 'rejected', 'under_review', or 'pending'"
      );
    }

    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();
    const applications = jobData.applications || [];
    const applicationIndex = applications.findIndex(
      (app: any) => app.student === studentId
    );

    if (applicationIndex === -1) {
      throw new NotFoundError("Application not found");
    }

    applications[applicationIndex].status = status;
    await updateDoc(jobRef, {
      applications,
      updatedAt: serverTimestamp(),
    });

    if (status === "selected") {
      const studentRef = doc(db, "students", studentId);
      await updateDoc(studentRef, {
        placed: true,
        placedJob: jobId,
        updatedAt: serverTimestamp(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Application status updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getRecruiterCompanyName = async (
  recruiterId: string
): Promise<string> => {
  const recruiterRef = doc(db, "recruiters", recruiterId);
  const recruiterDoc = await getDoc(recruiterRef);
  return recruiterDoc.exists()
    ? recruiterDoc.data().companyName || "Unknown Company"
    : "Unknown Company";
};
