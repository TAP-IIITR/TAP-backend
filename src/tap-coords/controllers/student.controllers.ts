import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response, NextFunction } from "express";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";

const STUDENTS_COLLECTION = "students";
const JOBS_COLLECTION = "jobs";

const getStudents: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const branch = req.query.branch as string | undefined;
    const batch = req.query.batch
      ? parseInt(req.query.batch as string)
      : undefined;

    // Build the query
    let studentsQuery = query(collection(db, STUDENTS_COLLECTION));
    if (branch) {
      studentsQuery = query(studentsQuery, where("branch", "==", branch));
    }
    if (batch) {
      studentsQuery = query(studentsQuery, where("batch", "==", batch));
    }

    const studentsSnap = await getDocs(studentsQuery);
    const students = studentsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

const getStudent: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const studentId = req.params.id;
    if (!studentId || typeof studentId !== "string") {
      throw new BadRequestError("Invalid student ID");
    }

    const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
    const studentDoc = await getDoc(studentRef);

    const cgpaRef = doc(db, "CGPA", studentId.toUpperCase());
    const cgpaDoc = await getDoc(cgpaRef);

    if (!studentDoc.exists()) {
      throw new NotFoundError("Student not found");
    }

    res.status(200).json({
      success: true,
      message: "Student retrieved successfully",
      data: {
        id: studentDoc.id,
        ...studentDoc.data(),
        cgpa: cgpaDoc.exists() ? cgpaDoc.data().cgpa : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getStudentApplications: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({
        success: false,
        message: "Access forbidden. TAP Coordinator access required.",
      });
      return;
    }

    const studentId = req.params.id;
    if (!studentId || typeof studentId !== "string") {
      throw new BadRequestError("Invalid student ID");
    }

    // Verify the student exists
    const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
    const studentDoc = await getDoc(studentRef);
    if (!studentDoc.exists()) {
      throw new NotFoundError("Student not found");
    }

    // Fetch all jobs and filter applications for this student
    let jobApplicationsQuery = query(
      collection(db, "jobApplications"),
      where("studentId", "==", studentId)
    );

    const jobApplicationsSnap = await getDocs(jobApplicationsQuery);
    let allApplications: any[] = [];

    for (const jobApplicationDoc of jobApplicationsSnap.docs) {
      const jobApplicationData = jobApplicationDoc.data();
      const jobRef = doc(db, "jobs", jobApplicationData.jobId);
      const jobDoc = await getDoc(jobRef);
      const jobData = jobDoc.data();

      allApplications.push({ ...jobApplicationData, job: jobData });
    }

    res.status(200).json({
      success: true,
      message: "Student applications retrieved successfully",
      data: allApplications,
    });
  } catch (error) {
    next(error);
  }
};

export { getStudents, getStudent, getStudentApplications };
