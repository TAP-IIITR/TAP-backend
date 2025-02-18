import { Request, Response, NextFunction } from "express";
import { collection, doc, getDoc, getDocs, query, where, updateDoc, addDoc, arrayUnion, serverTimestamp, DocumentReference } from "firebase/firestore";
import { db } from "../../config/firebase";
import { AuthenticatedRequest } from "../../types/express";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from "uuid";

// Add this interface near the top of the file
interface CGPARow {
  reg_no: string | number;
  cgpa: string | number;
}

// Dashboard Controller
export const getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== 'tap') {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    // Get dashboard statistics
    const stats = await getDashboardStats();
    
    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

async function getDashboardStats() {
  const studentsRef = collection(db, "students");
  const jobsRef = collection(db, "jobs");
  const recruitersRef = collection(db, "recruiters");

  const [studentsSnap, jobsSnap, recruitersSnap] = await Promise.all([
    getDocs(studentsRef),
    getDocs(jobsRef),
    getDocs(recruitersRef)
  ]);

  const totalStudents = studentsSnap.size;
  const totalJobs = jobsSnap.size;
  const totalRecruiters = recruitersSnap.size;

  let totalApplications = 0;
  jobsSnap.forEach(doc => {
    const data = doc.data();
    if (data.applications) {
      totalApplications += data.applications.length;
    }
  });

  return {
    totalStudents,
    totalJobs,
    totalRecruiters,
    totalApplications
  };
}

export const updateCGPA = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify user is TAP coordinator
    if (req.user?.role !== 'tap') {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    // Check if file exists in request
    if (!req.files || !('cgpaFile' in req.files)) {
      throw new BadRequestError('CGPA Excel file is required');
    }

    const file = (req.files as { [key: string]: any }).cgpaFile;
    
    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestError('Invalid file type. Only Excel files are allowed');
    }

    // Read Excel file
    const workbook = XLSX.read(file.data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<CGPARow>(worksheet);

    // Validate data structure
    if (!data.length || !data[0].hasOwnProperty('reg_no') || !data[0].hasOwnProperty('cgpa')) {
      throw new BadRequestError('Invalid Excel format. File must contain reg_no and cgpa columns');
    }

    // Update CGPAs
    const updates = [];
    for (const row of data) {
      const studentRef = doc(db, "students", row.reg_no.toString());
      updates.push(updateDoc(studentRef, {
        cgpa: parseFloat(row.cgpa.toString()),
        updatedAt: serverTimestamp()
      }));
    }

    await Promise.all(updates);

    res.status(200).json({
      success: true,
      message: `Successfully updated CGPA for ${updates.length} students`
    });
  } catch (error) {
    next(error);
  }
};
