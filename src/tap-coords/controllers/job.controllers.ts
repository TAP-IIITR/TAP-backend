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

import { sendEmail, generateJobNotificationEmail } from "../../utils/ses";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "your-bucket-name";

export const createJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }
    const { jobData } = req.body;
    console.log("jobData", jobData);
    if (!jobData) {
      throw new BadRequestError("Job data is required");
    }

    const job = JSON.parse(jobData);

    const {
      title,
      JD,
      location,
      salaryPackage,
      eligibility,
      eligibleBatches,
      deadline,
      form,
      company,
      jobType,
      recruiter,
    } = job;

    // Validate required fields
    if (
      !title ||
      !JD ||
      !location ||
      !salaryPackage ||
      !eligibility ||
      !eligibleBatches ||
      !deadline ||
      !form ||
      !company
    ) {
      throw new BadRequestError("All fields are required");
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
    let jdFileUrl: string | undefined;

    // Handle JD file upload if provided
    if (req.file) {
      const key = `jdFiles/${jobId}/jd.pdf`;
      const putObjectCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: "application/pdf",
        // Removed ACL: 'public-read' to avoid AccessControlListNotSupported error
      });

      const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
        expiresIn: 3600,
      });

      const s3Response = await fetch(uploadUrl, {
        method: "PUT",
        body: req.file.buffer,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": req.file.size.toString(),
        },
      });

      if (!s3Response.ok) {
        throw new BadRequestError(
          `S3 upload failed: ${await s3Response.text()}`
        );
      }

      jdFileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

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
      jobType,
      recruiter: recruiterId,
      createdBy: req.user.id,
      applications: [],
      status: "active", // Set as active directly
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // ...(jdFileUrl && { jdFile: jdFileUrl }),
      jdFileUrl,
    };

    const docRef = await addDoc(collection(db, "jobs"), newJob);

    // Send email notifications immediately when job is created
    const notificationResult = await sendJobNotificationsToEligibleStudents(
      docRef.id
    );

    res.status(201).json({
      success: true,
      message: "Job created successfully and notifications sent",
      data: {
        jobId,
        notifications: notificationResult,
      },
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
      res.status(403).json({
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

    // Remove the filter that restricts jobs to only those created by the current user
    let jobsQuery = query(collection(db, "jobs"));

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
          deadline: jobData.deadline,
          applications: jobData.applications || [],
          createdBy: jobData.createdBy || "Unknown", // Include the creator information
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
      res.status(403).json({
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
        jdFileUrl: jobData.jdFileUrl || null,
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
      res.status(403).json({
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
      res.status(403).json({
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
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const jobId = req.query.job as string;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;

    let jobApplicationsQuery = query(collection(db, "jobApplications"));
    if (jobId) {
      jobApplicationsQuery = query(
        jobApplicationsQuery,
        where("id", "==", jobId)
      );
    }

    const jobApplicationsSnap = await getDocs(jobApplicationsQuery);
    let allApplications: any[] = [];

    for (const jobApplicationDoc of jobApplicationsSnap.docs) {
      const jobApplicationData = jobApplicationDoc.data();
      const jobRef = doc(db, "jobs", jobApplicationData.jobId);
      const jobDoc = await getDoc(jobRef);
      const jobData = jobDoc.data();

      allApplications.push({ ...jobApplicationData, job: jobData });
    }

    // console.log("allApplications ", allApplications);

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

    // const applicationsWithDetails = await Promise.all(
    //   allApplications.map(async (app: any) => {
    //     const studentRef = doc(db, "students", app.student);
    //     const studentDoc = await getDoc(studentRef);
    //     const studentData = studentDoc.exists() ? studentDoc.data() : null;

    //     const cgpaRef = doc(db, "cgpa", app.student.toUpperCase());
    //     const cgpaDoc = await getDoc(cgpaRef);
    //     const cgpaData = cgpaDoc.exists() ? cgpaDoc.data() : null;

    //     return {
    //       ...app,
    //       student: studentData
    //         ? {
    //             id: studentDoc.id,
    //             name: `${studentData.firstName} ${studentData.lastName}`,
    //             email: studentData.regEmail,
    //             cgpa: cgpaData?.cgpa || "N/A",
    //             mobile: studentData.mobile,
    //             branch: studentData.branch,
    //             linkedin: studentData.linkedin,
    //             batch: studentData.batch,
    //             rollNumber: studentData.rollNumber,
    //           }
    //         : "Student not found",
    //     };
    //   })
    // );

    res.status(200).json({
      success: true,
      message: "Applications retrieved successfully",
      data: allApplications,
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
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const jobsRef = collection(db, "jobs");
    // Remove the filter that restricts pending jobs to only those created by the current user
    const q = query(jobsRef, where("status", "==", "pending_verification"));
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
            createdBy: jobData.createdBy || "Unknown", // Include creator information
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
      res.status(403).json({
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
    if (action === "approve") {
      await sendJobNotificationsToEligibleStudents(jobId);
    }

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
      res.status(403).json({
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

export const sendJobNotifications: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const jobId = req.params.id;
    if (!jobId) {
      throw new BadRequestError("Job ID is required");
    }

    const result = await sendJobNotificationsToEligibleStudents(jobId);

    res.status(200).json({
      success: true,
      message: "Job notifications sent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to send job notifications to eligible students
const sendJobNotificationsToEligibleStudents = async (jobId: string) => {
  // Get job details
  const jobRef = doc(db, "jobs", jobId);
  const jobDoc = await getDoc(jobRef);

  if (!jobDoc.exists()) {
    throw new NotFoundError("Job not found");
  }

  const jobData = jobDoc.data();
  const eligibleBatches = jobData.eligibleBatches || [];

  if (eligibleBatches.length === 0) {
    return { status: "No eligible batches specified" };
  }

  // Get company name
  let company = jobData.company || "Unknown Company";
  if (jobData.recruiter) {
    company = await getRecruiterCompanyName(jobData.recruiter);
  }

  // Construct job details for email
  const jobDetails = {
    ...jobData,
    company,
  };

  // Generate email content
  const { htmlBody, textBody } = generateJobNotificationEmail(jobDetails);
  const subject = `New Job Opportunity: ${jobData.title} at ${company}`;

  // Query all eligible students at once based on batch
  let emailsSent = 0;
  let eligibleStudents = 0;

  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("batch", "in", eligibleBatches));
  const studentsSnapshot = await getDocs(q);

  // Collect all eligible student emails
  const eligibleEmails: string[] = [];

  studentsSnapshot.forEach((snapshot) => {
    const student = snapshot.data();
    if (student && student.regEmail) {
      eligibleEmails.push(student.regEmail);
      eligibleStudents++;
    }
  });

  console.log(`Found ${eligibleStudents} eligible students for job ${jobId}`);

  // Send emails (if there are eligible students)
  if (eligibleEmails.length > 0) {
    // Process in batches of 50 emails to avoid SES limits
    const batchSize = 50;
    for (let i = 0; i < eligibleEmails.length; i += batchSize) {
      const batch = eligibleEmails.slice(i, i + batchSize);
      try {
        await sendEmail(batch, subject, htmlBody, textBody);
        emailsSent += batch.length;
        console.log(
          `Sent email batch ${i / batchSize + 1} (${batch.length} emails)`
        );
      } catch (error) {
        console.error(`Error sending email batch ${i / batchSize + 1}:`, error);
      }
    }
  }

  return {
    eligibleStudents,
    emailsSent,
    eligibleBatches,
  };
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
