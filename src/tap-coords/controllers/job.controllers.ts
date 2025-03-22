import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler, NextFunction } from "express"
import { db } from "../../config/firebase";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { v4 as uuidv4 } from 'uuid';

export const createJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const { title, JD, location, package: salaryPackage, eligibility, skills, deadline, form, company, recruiter } = req.body;

    // Validate required fields
    if (!title || !JD || !location || !salaryPackage || !eligibility || !skills || !deadline || !form || !company) {
      throw new BadRequestError("Missing required fields: title, JD, location, package, eligibility, skills, deadline, form, and company are required");
    }

    // If a recruiter is provided, validate that they exist
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
      skills,
      deadline: new Date(deadline),
      form,
      company, // Store the company name directly
      recruiter: recruiterId, // Optional: store recruiter ID if provided
      createdBy: req.user.id, // Associate the job with the TAP Coordinator
      applications: [],
      status: "active",
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
  
export const getAllJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const jobsRef = collection(db, "jobs");
    const jobsSnap = await getDocs(jobsRef);

    let jobs = await Promise.all(
      jobsSnap.docs.map(async (doc) => {
        const jobData = doc.data();
        // Fetch company name
        let company = jobData.company || "Unknown Company";
        if (jobData.recruiter) {
          company = await getRecruiterCompanyName(jobData.recruiter);
        }

        return {
          id: doc.id,
          ...jobData,
          company,
        };
      })
    );

    // Sort jobs by creation date (most recent first)
  
    // Apply limit if provided
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

export const getJobById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const jobId = req.params.id;
    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    const jobData = jobDoc.data();
    // Fetch company name
    let company = jobData.company || "Unknown Company";
    if (jobData.recruiter) {
      company = await getRecruiterCompanyName(jobData.recruiter);
    }

    res.status(200).json({
      success: true,
      message: "Job retrieved successfully",
      data: {
        id: jobDoc.id,
        ...jobData,
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};
  
 
  
  export const updateJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.params.id;
      const updates = { ...req.body, updatedAt: serverTimestamp() };
      delete updates.id; // Prevent ID modification
      delete updates.applications; // Prevent direct applications modification
      delete updates.createdAt; // Prevent creation date modification
  
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      await updateDoc(jobRef, updates);
  
      res.status(200).json({
        success: true,
        message: "Job updated successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const deleteJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.params.id;
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      // Instead of deleting, mark as inactive
      await updateDoc(jobRef, {
        status: 'inactive',
        updatedAt: serverTimestamp()
      });
  
      res.status(200).json({
        success: true,
        message: "Job deleted successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const getAllApplications = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== "tap") {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.query.job as string; // Optional jobId
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  
      // Fetch all jobs managed by the TAP Coordinator
      const jobsRef = collection(db, "jobs");
      let jobsQuery = query(jobsRef);
      if (jobId) {
        // If a jobId is provided, filter for that specific job
        jobsQuery = query(jobsRef, where("id", "==", jobId));
      }
  
      const jobsSnap = await getDocs(jobsQuery);
      let allApplications: any[] = [];
  
      // Iterate through each job to collect applications
      for (const jobDoc of jobsSnap.docs) {
        const jobData = jobDoc.data();
        const jobApplications = jobData.applications || [];
  
        // Add job details to each application for better context
        const applicationsWithJobDetails = jobApplications.map(async (app: any) => ({
          ...app,
          jobId: jobDoc.id,
          jobTitle: jobData.title,
          company: jobData.company || (jobData.recruiter ? await getRecruiterCompanyName(jobData.recruiter) : "Unknown Company"),
        }));
  
        // Resolve the promises for applicationsWithJobDetails
        const resolvedApplications = await Promise.all(applicationsWithJobDetails);
        allApplications.push(...resolvedApplications);
      }
  
      // If no applications are found, return an empty array
      if (allApplications.length === 0) {
        res.status(200).json({
          success: true,
          message: "No applications found",
          data: [],
        });
        return;
      }
  
      // Sort applications by application date (assuming appliedAt exists)
      allApplications.sort((a, b) => {
        const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
        const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
  
      // Apply limit if provided
      if (limit) {
        allApplications = allApplications.slice(0, limit);
      }
  
      // Fetch student details for each application
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
  
  
  
  // Helper function to fetch recruiter company name
  const getRecruiterCompanyName = async (recruiterId: string): Promise<string> => {
    const recruiterRef = doc(db, "recruiters", recruiterId);
    const recruiterDoc = await getDoc(recruiterRef);
    return recruiterDoc.exists() ? recruiterDoc.data().companyName || "Unknown Company" : "Unknown Company";
  };

  export const getPendingVerifications: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== "tap") {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      // Fetch jobs with status "pending_verification"
      const jobsRef = collection(db, "jobs");
      const q = query(jobsRef, where("status", "==", "pending_verification"));
      const jobsSnap = await getDocs(q);
  
      const pendingJobs = await Promise.all(
        jobsSnap.docs.map(async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
          const jobData = docSnapshot.data();
          // Fetch recruiter details if a recruiter exists, otherwise use the company field
          let company = jobData.company || "Unknown";
          if (jobData.recruiter) {
            const recruiterRef = doc(db, "recruiters", jobData.recruiter as string);
            const recruiterDoc = await getDoc(recruiterRef);
            const recruiterData = recruiterDoc.exists() ? recruiterDoc.data() : null;
            company = recruiterData?.companyName || company;
          }
  
          return {
            id: docSnapshot.id,
            title: jobData.title,
            company,
            location: jobData.location,
            ...jobData,
          };
        })
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

export const verifyJob: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const jobId = req.params.id;
    const { action } = req.body; // "approve" or "reject"

    if (!jobId || typeof jobId !== "string") {
      throw new BadRequestError("Invalid job ID");
    }
    if (!action || !["approve", "reject"].includes(action)) {
      throw new BadRequestError("Invalid action. Must be 'approve' or 'reject'");
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

    // Update job status based on action
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
export const updateApplicationStatus: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const jobId = req.params.jobId;
    const studentId = req.params.studentId;
    const { status } = req.body; // "selected", "rejected", "under_review", "pending"

    if (!jobId || typeof jobId !== "string") {
      throw new BadRequestError("Invalid job ID");
    }
    if (!studentId || typeof studentId !== "string") {
      throw new BadRequestError("Invalid student ID");
    }
    if (!status || !["selected", "rejected", "under_review", "pending"].includes(status)) {
      throw new BadRequestError("Invalid status. Must be 'selected', 'rejected', 'under_review', or 'pending'");
    }

    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();
    const applications = jobData.applications || [];
    const applicationIndex = applications.findIndex((app: any) => app.student === studentId);

    if (applicationIndex === -1) {
      throw new NotFoundError("Application not found");
    }

    // Update the application status
    applications[applicationIndex].status = status;
    await updateDoc(jobRef, {
      applications,
      updatedAt: serverTimestamp(),
    });

    // If the student is selected, update their placement status
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