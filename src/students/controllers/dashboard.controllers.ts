import { Request, Response, NextFunction } from "express";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { AuthenticatedRequest } from "../../types/express";

export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) {
      res.status(404).json({ success: false, message: "Student not found" });
      return;
    }
    const studentData = studentSnap.data();
    res.status(200).json({
      status: 200,
      message: "Student info sent",
      student: {
        first_name: studentData.firstName,
        last_name: studentData.lastName,
        email: studentData.regEmail,
        linkedin: studentData.linkedin,
        mobile: studentData.mobile,
        rollNumber: studentData.rollNumber,
        branch: studentData.branch,
        batch: studentData.batch,
        cgpa: studentData.cgpa,
        resume: studentData.resume ? studentData.resume.url : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = (req as any).user?.id;
    if (!studentId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { firstName, lastName, mobile, linkedin, anyOtherDemands } = req.body;
    const updates: any = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (mobile !== undefined) updates.mobile = mobile;
    if (linkedin !== undefined) updates.linkedin = linkedin;

    updates.updatedAt = new Date();

    const studentRef = doc(db, "students", studentId);
    await updateDoc(studentRef, updates);

    res
      .status(200)
      .json({ success: true, message: "Dashboard updated successfully" });
  } catch (error) {
    next(error);
  }
};
