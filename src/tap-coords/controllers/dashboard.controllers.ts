import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response, NextFunction } from "express";
import { read as readXlsx, utils } from "xlsx";
import {
  collection,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { ForbiddenError } from "../../errors/Forbidden.error";
import { BadRequestError } from "../../errors/Bad-Request-Error";


interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

export const getDashboard: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    
    const studentsSnapshot = await getDocs(collection(db, "students"));
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

    
    const jobsSnapshot = await getDocs(
      query(collection(db, "jobs"), where("deadline", ">", new Date()))
    );
    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      companyName: doc.data().recruiter.company_name,
      deadline: doc.data().deadline,
      package: doc.data().package,
    }));

    res.status(200).json({
      status: 200,
      message: "Dashboard data fetched successfully",
      data: {
        students: {
          total: students.length,
          list: students,
        },
        jobs: {
          total: jobs.length,
          list: jobs,
        },
      },
    });
  } catch (error) {
    next(error); 
  }
};

export const updateCGPA: RequestHandler = async (
  req: MulterRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== "tap") {
      throw new ForbiddenError("Not authorized");
    }

    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    
    if (!req.file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestError("Please upload an Excel file");
    }

    
    const workbook = readXlsx(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(worksheet) as Array<{
      Reg_No: string;
      CGPA: string;
    }>;

    
    if (
      !data.length ||
      !data[0].hasOwnProperty("Reg_No") ||
      !data[0].hasOwnProperty("CGPA")
    ) {
      throw new BadRequestError("Invalid file format");
    }

    
    const studentsRef = collection(db, "students");
    const updates = data.map(async (row: any) => {
      const studentDoc = doc(studentsRef, row.Reg_No);
      return updateDoc(studentDoc, {
        cgpa: parseFloat(row.CGPA),
      });
    });

    await Promise.all(updates);

    res.status(200).json({
      status: 200,
      message: "CGPA updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
