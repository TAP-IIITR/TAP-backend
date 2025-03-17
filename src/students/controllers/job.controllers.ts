import { Request, Response, NextFunction } from "express";
import {
  collection,
  getDocs,
  query as q,
  where,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
  doc,
  increment
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../../types/express";

// GET /jobs?query={job_type}
export const getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryRaw = req.query.query ? req.query.query.toString().toLowerCase() : "all";
    let jobsQuery;
    if (queryRaw === "all") {
      jobsQuery = q(collection(db, "jobs"));
    } else if (["intern", "fte", "intern_fte"].includes(queryRaw)) {
      jobsQuery = q(collection(db, "jobs"), where("job_type", "==", queryRaw));
    } else {
      res.status(400).json({ success: false, message: "Invalid job type" });
      return;
    }
    const querySnapshot = await getDocs(jobsQuery);
    const jobsData: any[] = [];
    querySnapshot.forEach((docSnapshot) => {
      // No need to fetch form as per requirements
      const jobData = docSnapshot.data();
      const { applications, form, ...jobInfo } = jobData;

      // Add application count instead of full applications array
      jobsData.push({
        id: docSnapshot.id,
        ...jobInfo,
        applicationCount: applications ? applications.length : 0
      });
    });

    res.status(200).json({
      statusCode: 200,
      message: "Jobs fetched",
      jobs: jobsData
    });
  } catch (error) {
    next(error);
  }
};

// GET /jobs/:id
// GET /jobs/:id - Modified version
export const getJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;
    const jobsQuery = q(collection(db, "jobs"), where("job_id", "==", jobId));
    const querySnapshot = await getDocs(jobsQuery);

    if (querySnapshot.empty) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    const jobDoc = querySnapshot.docs[0];
    if (!jobDoc.exists()) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    const jobData = jobDoc.data() as any;

    // Check if job is expired
    const deadline = new Date(jobData.deadline) || jobData.deadline?.toDate();
    const now = new Date();
    if (deadline < now) {
      res.status(400).json({ success: false, message: "This job posting has expired" });
      return;
    }

    // Get form without applications
    const { applications, ...jobInfo } = jobData;
    let formWithStudentInfo = JSON.parse(jobInfo.form) || {};

    // Get student info and add to form if student is authenticated
    const student = req.user;
    if (student) {
      // Check if student has already applied
      if (jobData.applications) {
        const hasApplied = jobData.applications.some((app: any) => app.student === student.id);
        if (hasApplied) {
          res.status(400).json({ success: false, message: "You have already applied for this job" });
          return;
        }
      }

      // Get student details to pre-fill the form
      try {
        const studentRef = doc(db, "students", student.id);
        const studentDoc = await getDoc(studentRef);

        if (studentDoc.exists()) {
          const studentData = studentDoc.data();

          // Add student info to the form
          formWithStudentInfo = {
            ...formWithStudentInfo,
            studentName: `${studentData.firstName} ${studentData.lastName}`,
            contactNumber: studentData.mobile || "Not provided",
            email: studentData.regEmail,
            cgpa: studentData.cgpa || 0,
            resumeUrl: studentData.resume ? studentData.resume.url : "Not provided"
          };
        }
      } catch (err) {
        console.error("Error fetching student data for form:", err);
        // Continue without student data if there's an error
      }
    }

    res.status(200).json({
      statusCode: 200,
      message: "Job fetched",
      job: {
        id: jobDoc.id,
        ...jobInfo,
        form: JSON.stringify(formWithStudentInfo), // Send the form with student info
        applicationCount: applications ? applications.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /jobs/:id/apply
export const applyJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;
    const jobsQuery = q(collection(db, "jobs"), where("job_id", "==", jobId));
    const querySnapshot = await getDocs(jobsQuery);

    if (querySnapshot.empty) {
      res.status(404).json({ success: false, message: "Job not found" });
      return;
    }

    const jobDoc = querySnapshot.docs[0];
    const jobDocRef = jobDoc.ref;
    const jobData = jobDoc.data();

    // Check if job is expired
    const deadline = new Date(jobData.deadline) || jobData.deadline?.toDate();
    const now = new Date();
    if (deadline < now) {
      res.status(400).json({ success: false, message: "This job posting has expired" });
      return;
    }

    // Get student info
    const student = req.user;
    if (!student) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Check if student has already applied
    if (jobData.applications) {
      const hasApplied = jobData.applications.some((app: any) => app.student === student.id);
      if (hasApplied) {
        res.status(400).json({ success: false, message: "You have already applied for this job" });
        return;
      }
    }

    // Get form data from request
    let jobApplicationForm = req.body.form;
    if (!jobApplicationForm) {
      res.status(400).json({ success: false, message: "Application form is required" });
      return;
    }

    if (typeof jobApplicationForm === "string") {
      try {
        jobApplicationForm = JSON.parse(jobApplicationForm);
      } catch (err) {
        res.status(400).json({ success: false, message: "Application form must be valid JSON" });
        return;
      }
    }

    // Get student details only if form is missing student information
    if (!jobApplicationForm.studentName || !jobApplicationForm.email) {
      const studentRef = doc(db, "students", student.id);
      const studentDoc = await getDoc(studentRef);

      if (!studentDoc.exists()) {
        res.status(404).json({ success: false, message: "Student record not found" });
        return;
      }

      const studentData = studentDoc.data();

      // Add student info to form
      jobApplicationForm = {
        ...jobApplicationForm,
        studentName: `${studentData.firstName} ${studentData.lastName}`,
        contactNumber: studentData.mobile || "Not provided",
        email: studentData.regEmail,
        cgpa: studentData.cgpa || 0,
        resumeUrl: studentData.resume ? studentData.resume.url : "Not provided"
      };
    }

    // Create application object
    const applicationId = uuidv4();

    // Create application document to store in jobApplications collection
    const jobApplication = {
      id: applicationId,
      jobId: jobId,
      studentId: student.id,
      form: jobApplicationForm,
      createdAt: serverTimestamp(),
      status: "Pending"
    };

    // Add to jobApplications collection
    await addDoc(collection(db, "jobApplications"), jobApplication);

    // Update the job's application count and add to applications array
    await updateDoc(jobDocRef, {
      applicationCount: increment(1),
      applications: arrayUnion({
        id: applicationId,
        student: student.id,
        createdAt: serverTimestamp()
      })
    });

    res.status(200).json({
      statusCode: 200,
      message: "Application submitted successfully",
      applicationId
    });
  } catch (error) {
    console.error("Error applying for job:", error);
    next(error);
  }
};

