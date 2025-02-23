import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response, NextFunction } from "express";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
  Query,
  CollectionReference,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { ForbiddenError } from "../../errors/Forbidden.error";
import { NotFoundError } from "../../errors/NotFound.error";

interface JobApplication {
  student: string;
  createdAt: Date;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}

export const getStudents: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    const { branch, batch } = req.query;
    let studentsQuery: Query | CollectionReference = collection(db, "students");

    if (branch) {
      studentsQuery = query(studentsQuery, where("branch", "==", branch));
    }
    if (batch) {
      studentsQuery = query(studentsQuery, where("batch", "==", Number(batch)));
    }

    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: `${data.firstName} ${data.lastName}`,
        regNo: doc.id,
        branch: data.branch,
        batch: data.batch_year,
        cgpa: data.cgpa,
      };
    });

    res.status(200).json({
      status: 200,
      message: "Students fetched successfully",
      data: {
        students,
        totalStudents: students.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStudent: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    const { id } = req.params;
    const studentDoc = await getDoc(doc(db, "students", id));

    if (!studentDoc.exists()) {
      throw new NotFoundError("Student not found");
    }

    const studentData = studentDoc.data();
    res.status(200).json({
      status: 200,
      message: "Student details fetched successfully",
      data: {
        id: studentDoc.id,
        name: `${studentData.firstName} ${studentData.lastName}`,
        regNo: studentDoc.id,
        email: studentData.reg_email,
        branch: studentData.branch,
        batch: studentData.batch_year,
        cgpa: studentData.cgpa,
        contact: studentData.contact,
        resume: studentData.resume,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentApplications: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    const { id } = req.params;
    const jobsSnapshot = await getDocs(collection(db, "jobs"));

    const applications = jobsSnapshot.docs.flatMap((doc) => {
      const jobData = doc.data();
      return (jobData.applications || [])
        .filter((app: JobApplication) => app.student === id)
        .map((app: JobApplication) => ({
          jobId: doc.id,
          companyName: jobData.recruiter.company_name,
          jobTitle: jobData.title,
          appliedAt: app.createdAt,
          status: app.status,
          package: jobData.package,
        }));
    });

    res.status(200).json({
      status: 200,
      message: "Applications fetched successfully",
      data: {
        applications,
        totalApplications: applications.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
