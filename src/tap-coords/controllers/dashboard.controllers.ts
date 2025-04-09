import { Request, Response, NextFunction } from "express";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
  DocumentReference,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { AuthenticatedRequest } from "../../types/express";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";

// Add these interfaces near the top of the file
interface CGPARow {
  reg_no: string | number;
  cgpa: string | number;
}

interface CGPARecord {
  roll_no: string;
  semester: string;
  cgpa: number;
  timestamp: any;
}

// Dashboard Controller
export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    console.log("CAME HERE ");
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }
    console.log("HERE TOO");

    // Get dashboard statistics
    const stats = await getDashboardStats();

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

async function getDashboardStats() {
  try {
    const studentsRef = collection(db, "students");
    const jobsRef = collection(db, "jobs");
    const recruitersRef = collection(db, "recruiters");

    const [studentsSnap, jobsSnap, recruitersSnap] = await Promise.all([
      getDocs(studentsRef),
      getDocs(jobsRef),
      getDocs(recruitersRef),
    ]);

    const totalStudents = studentsSnap.size;
    const totalJobs = jobsSnap.size;
    const totalRecruiters = recruitersSnap.size;

    // Calculate active jobs
    const activeJobs = jobsSnap.docs.filter(
      (doc) => doc.data().status === "active"
    ).length;

    // Calculate pending verifications
    const pendingVerifications = jobsSnap.docs.filter(
      (doc) => doc.data().status === "pending_verification"
    ).length;

    // Calculate total applications
    let totalApplications = 0;
    jobsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.applications) {
        totalApplications += data.applications.length;
      }
    });

    // Calculate verified recruiters
    const verifiedRecruiters = recruitersSnap.docs.filter(
      (doc) => doc.data().isVerified
    ).length;

    // Calculate placed students
    const placedStudents = studentsSnap.docs.filter(
      (doc) => doc.data().placed === true
    ).length;

    return {
      totalStudents,
      totalJobs,
      activeJobs,
      totalRecruiters,
      verifiedRecruiters,
      totalApplications,
      pendingVerifications,
      placedStudents,
    };
  } catch (error) {
    console.log("Can't get dashboard stats:", error);
    throw error;
  }
}
export const updateCGPA = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== "tap") {
      res
        .status(403)
        .json({
          success: false,
          message: "Access forbidden. TAP Coordinator access required.",
        });
      return;
    }

    // Check if file exists in request
    if (!req.files || !("cgpaFile" in req.files)) {
      throw new BadRequestError("CGPA Excel file is required");
    }

    // Check if semester is provided
    if (!req.body.semester) {
      throw new BadRequestError("Semester is required");
    }

    const semester = req.body.semester;
    const file = (req.files as { [key: string]: any }).cgpaFile;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestError(
        "Invalid file type. Only Excel files are allowed"
      );
    }

    // Read Excel file
    const workbook = XLSX.read(file.data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<CGPARow>(worksheet);

    // Validate data structure
    if (
      !data.length ||
      !data[0].hasOwnProperty("reg_no") ||
      !data[0].hasOwnProperty("cgpa")
    ) {
      throw new BadRequestError(
        "Invalid Excel format. File must contain reg_no and cgpa columns"
      );
    }

    // Update CGPAs in both collections
    const studentUpdates = [];
    const cgpaUpdates = [];

    for (const row of data) {
      const rollNo = row.reg_no.toString();
      const cgpaValue = parseFloat(row.cgpa.toString());

      // Update student document
      const studentRef = doc(db, "students", rollNo);
      studentUpdates.push(
        updateDoc(studentRef, {
          cgpa: cgpaValue,
          updatedAt: serverTimestamp(),
        })
      );

      // Create/update document in CGPA collection
      // Using a compound ID of rollNo_semester as the document ID
      const cgpaDocId = `2023UG${rollNo}`;
      const cgpaDocRef = doc(db, "CGPA", cgpaDocId);

      const cgpaRecord: CGPARecord = {
        roll_no: rollNo,
        semester: semester,
        cgpa: cgpaValue,
        timestamp: serverTimestamp(),
      };

      cgpaUpdates.push(setDoc(cgpaDocRef, cgpaRecord));
    }

    // Execute all updates
    await Promise.all([...studentUpdates, ...cgpaUpdates]);

    res.status(200).json({
      success: true,
      message: `Successfully updated CGPA for ${studentUpdates.length} students and added semester records`,
    });
  } catch (error) {
    next(error);
  }
};
