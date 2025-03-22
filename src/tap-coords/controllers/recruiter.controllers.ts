import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response, NextFunction } from "express";
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../../config/firebase";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import { v4 as uuidv4 } from "uuid";

const RECRUITERS_COLLECTION = "recruiters";

const getAllRecruiters: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    // Fetch all recruiters, sort by isVerified (false first)
    const recruitersRef = collection(db, RECRUITERS_COLLECTION);
    const q = query(recruitersRef, orderBy("isVerified", "asc"));
    const recruitersSnap = await getDocs(q);

    const recruiters = recruitersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      message: "Recruiters retrieved successfully",
      data: recruiters,
    });
  } catch (error) {
    next(error);
  }
};

const getRecruiterById: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const recruiterId = req.params.id;
    if (!recruiterId || typeof recruiterId !== "string") {
      throw new BadRequestError("Invalid recruiter ID format");
    }

    const recruiterRef = doc(db, RECRUITERS_COLLECTION, recruiterId);
    const recruiterDoc = await getDoc(recruiterRef);

    if (!recruiterDoc.exists()) {
      throw new NotFoundError("Recruiter not found");
    }

    res.status(200).json({
      success: true,
      message: "Recruiter retrieved successfully",
      data: {
        id: recruiterDoc.id,
        ...recruiterDoc.data(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const verifyRecruiter: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const recruiterId = req.params.id;
    if (!recruiterId || typeof recruiterId !== "string") {
      throw new BadRequestError("Invalid recruiter ID format");
    }

    const recruiterRef = doc(db, RECRUITERS_COLLECTION, recruiterId);
    const recruiterDoc = await getDoc(recruiterRef);

    if (!recruiterDoc.exists()) {
      throw new NotFoundError("Recruiter not found");
    }

    // Update the recruiter's verification status
    await updateDoc(recruiterRef, {
      isVerified: true,
      updatedAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Recruiter verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

const deleteRecruiter: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if the user is a TAP Coordinator
    if (req.user?.role !== "tap") {
      res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
      return;
    }

    const recruiterId = req.params.id;
    if (!recruiterId || typeof recruiterId !== "string") {
      throw new BadRequestError("Invalid recruiter ID format");
    }

    const recruiterRef = doc(db, RECRUITERS_COLLECTION, recruiterId);
    const recruiterDoc = await getDoc(recruiterRef);

    if (!recruiterDoc.exists()) {
      throw new NotFoundError("Recruiter not found");
    }

    // Delete the recruiter
    await deleteDoc(recruiterRef);

    res.status(200).json({
      success: true,
      message: "Recruiter deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export { getAllRecruiters, getRecruiterById, verifyRecruiter, deleteRecruiter };