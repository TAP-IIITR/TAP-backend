import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler, NextFunction } from "express"
import { db } from "../../config/firebase";
import { BadRequestError } from "../../errors/Bad-Request-Error";

export const createJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const { title, JD, location, package: salaryPackage, eligibility, skills, deadline, form, recruiter } = req.body;
  
      // Validate recruiter exists
      const recruiterRef = doc(db, "recruiters", recruiter);
      const recruiterDoc = await getDoc(recruiterRef);
      if (!recruiterDoc.exists()) {
        res.status(404).json({ success: false, message: "Recruiter not found" });
        return;
      }
  
      const jobId = uuidv4();
      const newJob = {
        id: jobId,
        title,
        JD,
        location,
        package: salaryPackage,
        eligibility,
        skills,
        deadline: new Date(deadline),
        form,
        recruiter,
        applications: [],
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
  
      await addDoc(collection(db, "jobs"), newJob);
  
      res.status(201).json({
        success: true,
        message: "Job created successfully",
        data: { jobId }
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const getAllJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobsRef = collection(db, "jobs");
      const jobsSnap = await getDocs(jobsRef);
      
      const jobs = jobsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      res.status(200).json({
        success: true,
        message: "Jobs retrieved successfully",
        data: jobs
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const getJobById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.params.id;
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      res.status(200).json({
        success: true,
        message: "Job retrieved successfully",
        data: {
          id: jobDoc.id,
          ...jobDoc.data()
        }
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const updateJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.params.id;
      const updates = { ...req.body, updatedAt: serverTimestamp() };
      delete updates.id; // Prevent ID modification
      delete updates.applications; // Prevent direct applications modification
      delete updates.createdAt; // Prevent creation date modification
  
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      await updateDoc(jobRef, updates);
  
      res.status(200).json({
        success: true,
        message: "Job updated successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const deleteJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.params.id;
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      // Instead of deleting, mark as inactive
      await updateDoc(jobRef, {
        status: 'inactive',
        updatedAt: serverTimestamp()
      });
  
      res.status(200).json({
        success: true,
        message: "Job deleted successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  
  export const getAllApplications = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify user is TAP coordinator
      if (req.user?.role !== 'tap') {
        res.status(403).json({ success: false, message: "Access forbidden. TAP Coordinator access required." });
        return;
      }
  
      const jobId = req.query.job as string;
      if (!jobId) {
        throw new BadRequestError('Job ID is required');
      }
  
      const jobRef = doc(db, "jobs", jobId);
      const jobDoc = await getDoc(jobRef);
  
      if (!jobDoc.exists()) {
        res.status(404).json({ success: false, message: "Job not found" });
        return;
      }
  
      const jobData = jobDoc.data();
      const applications = jobData.applications || [];
  
      // Fetch student details for each application
      const applicationsWithDetails = await Promise.all(
        applications.map(async (app: any) => {
          const studentRef = doc(db, "students", app.student);
          const studentDoc = await getDoc(studentRef);
          const studentData = studentDoc.exists() ? studentDoc.data() : null;
  
          return {
            ...app,
            student: studentData ? {
              id: studentDoc.id,
              name: `${studentData.firstName} ${studentData.lastName}`,
              email: studentData.regEmail,
              cgpa: studentData.cgpa || 'N/A'
            } : 'Student not found'
          };
        })
      );
  
      res.status(200).json({
        success: true,
        message: "Applications retrieved successfully",
        data: applicationsWithDetails
      });
    } catch (error) {
      next(error);
    }
  };

function uuidv4() {
    throw new Error("Function not implemented.");
}
  