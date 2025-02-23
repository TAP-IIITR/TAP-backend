import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler, NextFunction } from "express";
import {
  collection,
  getDocs,
  query as q,
  where,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/NotFound.error";
import { AuthError } from "../../errors/Auth-Error";

// Get all jobs with optional filtering
export const getJobs: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }

    const queryRaw = req.query.query?.toString().toLowerCase() || "all";

    if (!["all", "intern", "fte", "intern_fte"].includes(queryRaw)) {
      throw new BadRequestError("Invalid job type");
    }

    let jobsQuery =
      queryRaw === "all"
        ? q(collection(db, "jobs"))
        : q(collection(db, "jobs"), where("job_type", "==", queryRaw));

    const querySnapshot = await getDocs(jobsQuery);
    const jobsData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      jd: doc.data().JD,
      location: doc.data().location,
      package: doc.data().package,
      eligibility: doc.data().eligibility,
      skills: doc.data().skills,
      deadline: doc.data().deadline.toDate(),
      recruiter: {
        company_name: doc.data().recruiter.company_name,
      },
      job_type: doc.data().job_type,
    }));

    res.status(200).json({
      status: 200,
      message: "Jobs fetched successfully",
      data: {
        jobs: jobsData,
        total: jobsData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single job details
export const getJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }

    const jobId = req.params.id;
    const jobDoc = await getDoc(doc(db, "jobs", jobId));

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();

    // Check if student has already applied
    const hasApplied = jobData.applications?.some(
      (app: any) => app.student === req.user?.id
    );

    res.status(200).json({
      status: 200,
      message: "Job fetched successfully",
      data: {
        job: {
          id: jobDoc.id,
          title: jobData.title,
          jd: jobData.JD,
          location: jobData.location,
          package: jobData.package,
          eligibility: jobData.eligibility,
          skills: jobData.skills,
          deadline: jobData.deadline.toDate(),
          form: jobData.form,
          recruiter: {
            company_name: jobData.recruiter.company_name,
          },
          hasApplied,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Apply for a job
export const applyJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError("Unauthorized");
    }

    const jobId = req.params.id;
    const jobDoc = await getDoc(doc(db, "jobs", jobId));

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();

    // Check if deadline has passed
    if (jobData.deadline.toDate() < new Date()) {
      throw new BadRequestError("Application deadline has passed");
    }

    // Check if student has already applied
    if (
      jobData.applications?.some((app: any) => app.student === req.user!.id)
    ) {
      throw new BadRequestError("Already applied to this job");
    }

    // Validate form data
    let formData = req.body.form;
    if (!formData) {
      throw new BadRequestError("Application form is required");
    }

    if (typeof formData === "string") {
      try {
        formData = JSON.parse(formData);
      } catch (err) {
        throw new BadRequestError("Invalid form data format");
      }
    }

    // Check eligibility criteria
    const student = await getDoc(doc(db, "students", req.user!.id));
    const studentData = student.data();

    if (!studentData) {
      throw new NotFoundError("Student data not found");
    }

    if (studentData.cgpa < jobData.eligibility.cgpa) {
      throw new BadRequestError("CGPA criteria not met");
    }

    if (!jobData.eligibility.branches.includes(studentData.branch)) {
      throw new BadRequestError("Branch not eligible");
    }

    if (jobData.eligibility.batch !== studentData.batch_year) {
      throw new BadRequestError("Batch year not eligible");
    }

    const jobApplication = {
      uuid: uuidv4(),
      job: jobId,
      student: req.user.id,
      form: formData,
      createdAt: new Date(),
      status: "PENDING",
    };

    // Update job document with new application
    await updateDoc(doc(db, "jobs", jobId), {
      applications: arrayUnion(jobApplication),
    });

    // Update student document with applied job
    await updateDoc(doc(db, "students", req.user.id), {
      applied_to: arrayUnion(jobId),
    });

    res.status(200).json({
      status: 200,
      message: "Application submitted successfully",
      data: {
        application: {
          id: jobApplication.uuid,
          jobId,
          status: jobApplication.status,
          appliedAt: jobApplication.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
