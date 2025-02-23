import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler, NextFunction } from "express";
import { db } from "../../config/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDoc,
} from "firebase/firestore";

import { ForbiddenError } from "../../errors/Forbidden.error";
import { NotFoundError } from "../../errors/NotFound.error";
import { BadRequestError } from "../../errors/Bad-Request-Error";

export const createJob: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    if (
      !req.body.title ||
      !req.body.JD ||
      !req.body.location ||
      !req.body.package ||
      !req.body.eligibility ||
      !req.body.skills ||
      !req.body.deadline ||
      !req.body.recruiter
    ) {
      throw new BadRequestError("Missing required fields");
    }

    if (
      !req.body.eligibility.cgpa ||
      !req.body.eligibility.branches ||
      !req.body.eligibility.batch
    ) {
      throw new BadRequestError("Missing eligibility criteria");
    }

    const jobData = {
      title: req.body.title,
      JD: req.body.JD,
      location: req.body.location,
      package: req.body.package,
      eligibility: {
        cgpa: req.body.eligibility.cgpa,
        branches: req.body.eligibility.branches,
        batch: req.body.eligibility.batch,
      },
      skills: req.body.skills,
      deadline: new Date(req.body.deadline),
      form: req.body.form,
      recruiter: {
        company_name: req.body.recruiter.company_name,
        hr_name: req.body.recruiter.hr_name,
        hr_contact: req.body.recruiter.hr_contact,
        hr_email: req.body.recruiter.hr_email,
      },
      applications: [],
      createdAt: new Date(),
    };

    const jobRef = await addDoc(collection(db, "jobs"), jobData);

    res.status(201).json({
      status: 201,
      message: "Job created successfully",
      data: {
        jobId: jobRef.id,
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
      throw new ForbiddenError("Not authorized");
    }

    const jobsSnapshot = await getDocs(collection(db, "jobs"));
    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt (newest first)
    jobs.sort((a: any, b: any) => b.createdAt - a.createdAt);

    res.status(200).json({
      status: 200,
      message: "Jobs fetched successfully",
      data: {
        jobs,
        totalJobs: jobs.length,
      },
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
      throw new ForbiddenError("Not authorized");
    }

    const { id } = req.params;
    const jobDoc = await getDoc(doc(db, "jobs", id));

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    res.status(200).json({
      status: 200,
      message: "Job fetched successfully",
      data: {
        job: {
          id: jobDoc.id,
          ...jobDoc.data(),
        },
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
      throw new ForbiddenError("Not authorized");
    }

    const { id } = req.params;
    const jobRef = doc(db, "jobs", id);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    await updateDoc(jobRef, req.body);

    res.status(200).json({
      status: 200,
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
      throw new ForbiddenError("Not authorized");
    }

    const { id } = req.params;
    const jobRef = doc(db, "jobs", id);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    await deleteDoc(jobRef);

    res.status(200).json({
      status: 200,
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
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    const jobId = req.query.job as string;
    const applicationsRef = collection(db, "applications");
    const applicationsQuery = query(
      applicationsRef,
      where("jobId", "==", jobId)
    );

    const applicationsSnapshot = await getDocs(applicationsQuery);
    const applications = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      appliedAt: doc.data().appliedAt?.toDate(),
    }));

    res.status(200).json({
      status: 200,
      message: "Applications fetched successfully",
      data: {
        applications,
        total: applications.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
