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
  increment,
  Timestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../../types/express";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";

// interface JobData {
//   job_type: string;
//   applications?: any[];
//   form?: any;
//   [key: string]: any;
// }

interface ResponseJob {
  id: string;
  applicationCount: number;
  [key: string]: any;
}

// interface FormField {
//   [key: string]: string; // e.g., { "Experiences": "number", "interns": "string" }
// }

// interface JobApplicationForm {
//   studentName: string;
//   email: string;
//   contactNumber: string;
//   cgpa: number;
//   resumeUrl: string;
//   [key: string]: any; // For dynamic form fields like Experiences, interns, etc.
// }
// GET /jobs?query={job_type}
export const getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate and process query parameter
    const queryRaw = req.query.query ? req.query.query.toString().toLowerCase() : 'all';

    // Define job query based on query parameter
    let jobsQuery;
    const validJobTypes = ['intern', 'fte', 'intern_fte'];

    switch (queryRaw) {
      case 'all':
        jobsQuery = q(collection(db, 'jobs'));
        break;
      case 'intern':
      case 'fte':
      case 'intern_fte':
        jobsQuery = q(
          collection(db, 'jobs'), 
          where('job_type', '==', queryRaw)
        );
        break;
      default:
        res.status(400).json({ 
          success: false, 
          message: 'Invalid job type' 
        });
        return;
    }

    // Fetch jobs from Firestore
    const querySnapshot = await getDocs(jobsQuery);

    // Transform jobs data
    const jobsData: ResponseJob[] = querySnapshot.docs.map((docSnapshot) => {
      const jobData = docSnapshot.data() as JobData;
      const { applications, form, ...jobInfo } = jobData;

      return { 
        ...jobInfo, // Spread other job info
        id: docSnapshot.id, // Explicitly use Firestore document ID
        applicationCount: applications?.length || 0
      };
    });

    // Send response
    res.status(200).json({
      statusCode: 200,
      message: 'Jobs fetched',
      jobs: jobsData
    });

  } catch (error) {
    next(error);
  }
};

  const getRecruiterCompanyName = async (recruiterId: string): Promise<string> => {
  const recruiterRef = doc(db, "recruiters", recruiterId);
  const recruiterDoc = await getDoc(recruiterRef);
  return recruiterDoc.exists() ? recruiterDoc.data().companyName || "Unknown Company" : "Unknown Company";
};
// GET /jobs/:id
// GET /jobs/:id - Modified version
export const getJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;
    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();
    let company = jobData.company || "Unknown Company";
    if (jobData.recruiter) {
      company = await getRecruiterCompanyName(jobData.recruiter);
    }

    // Get student details if authenticated
    let studentData = null;
    let hasApplied = false;
    const student = req.user;

    if (student) {
      const studentRef = doc(db, "students", student.id);
      const studentDoc = await getDoc(studentRef);

      if (!studentDoc.exists()) {
        throw new NotFoundError("Student record not found");
      }

      studentData = studentDoc.data();

      // Check if the student has already applied
      if (jobData.applications) {
        hasApplied = jobData.applications.some((app: any) => app.student === student.id);
      }
    }
    else {
      throw new NotFoundError("Student record not found");

    }

    res.status(200).json({
      success: true,
      message: "Job retrieved successfully",
      data: {
        id: jobDoc.id,
        title: jobData.title,
        JD: jobData.JD,
        location: jobData.location,
        jobType: jobData.jobType || "Full-Time",
        package: jobData.package,
        eligibility: jobData.eligibility,
        skills: jobData.skills,
        deadline: jobData.deadline,
        form: jobData.form,
        company,
        status: jobData.status,
        applications: jobData.applications || [],
        createdAt: (jobData.createdAt as Timestamp)?.toDate().toISOString(),
        student: studentData
          ? {
              id: student.id,
              firstName: studentData.firstName,
              lastName: studentData.lastName,
              regEmail: studentData.regEmail,
              mobile: studentData.mobile,
              cgpa: studentData.cgpa,
              resume: studentData.resume,
              branch: studentData.branch,
            }
          : null,
        hasApplied,
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /jobs/:id/apply

interface JobData {
  job_type: string;
  applications?: any[];
  form?: any;
  [key: string]: any;
}

interface FormField {
  [key: string]: string; // e.g., { "Experiences": "number", "interns": "string" }
}

interface JobApplicationForm {
  studentName: string;
  email: string;
  contactNumber: string;
  cgpa: number;
  resumeUrl: string;
  [key: string]: any; // For dynamic form fields
}

// POST /jobs/student/:id/apply
export const applyJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log("HsldfkajsldfkjasldkfjasldfkjsaldkfjsldkRE")
    const jobId = req.params.id;
    const jobRef = doc(db, "jobs", jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new NotFoundError("Job not found");
    }

    const jobData = jobDoc.data();

    // Check if job is expired
    const deadline = new Date(jobData.deadline);
    const now = new Date();
    if (deadline < now) {
      throw new BadRequestError("This job posting has expired");
    }

    // Get student info
    const student = req.user;
    if (!student) {
      throw new BadRequestError("Unauthorized");
    }

    // Check if student has already applied
    if (jobData.applications) {
      const hasApplied = jobData.applications.some((app: any) => app.student === student.id);
      if (hasApplied) {
        throw new BadRequestError("You have already applied for this job");
      }
    }

    // Parse the job's form field (it's an array of objects)
    let jobForm: { label: string; type: string }[];
    try {
      jobForm = jobData.form || []; // Default to empty array if undefined
    } catch (err) {
      throw new BadRequestError("Invalid form structure in job data");
    }

    // Get form data from request
    let jobApplicationForm: JobApplicationForm = req.body.form;
    if (!jobApplicationForm) {
      throw new BadRequestError("Application form is required");
    }

    if (typeof jobApplicationForm === "string") {
      try {
        jobApplicationForm = JSON.parse(jobApplicationForm);
      } catch (err) {
        throw new BadRequestError("Application form must be valid JSON");
      }
    }

    // Validate that all required form fields are provided
    const formFieldMap: FormField = {};
    jobForm.forEach((field: { label?: string; type: string }) => {
      if (field.label) { // Only add fields with a defined label
        formFieldMap[field.label] = field.type;
      }
    });

    for (const [fieldName, fieldType] of Object.entries(formFieldMap)) {
      if (!(fieldName in jobApplicationForm)) {
        throw new BadRequestError(`Missing required field: ${fieldName}`);
      }

      // Validate field type
      const value = jobApplicationForm[fieldName];
      if (fieldType === "number" && typeof value !== "number") {
        throw new BadRequestError(`${fieldName} must be a number`);
      }
      if (fieldType === "string" || fieldType === "text" || fieldType === "textarea" || fieldType === "file") {
        if (typeof value !== "string") {
          throw new BadRequestError(`${fieldName} must be a string`);
        }
      }
    }

    // Get student details if form is missing student information
    if (!jobApplicationForm.studentName || !jobApplicationForm.email) {
      const studentRef = doc(db, "students", student.id);
      const studentDoc = await getDoc(studentRef);

      if (!studentDoc.exists()) {
        throw new NotFoundError("Student record not found");
      }

      const studentData = studentDoc.data();

      jobApplicationForm = {
        ...jobApplicationForm,
        studentName: `${studentData.firstName} ${studentData.lastName}`,
        contactNumber: studentData.mobile || "Not provided",
        email: studentData.regEmail,
        cgpa: studentData.cgpa || 0,
        resumeUrl: studentData.resume ? studentData.resume.url : "Not provided",
      };
    }

    // Filter out empty keys from jobApplicationForm
    const sanitizedForm = Object.fromEntries(
      Object.entries(jobApplicationForm).filter(([key]) => key !== "" && key !== undefined)
    );

    // Create application object
    const applicationId = uuidv4();
    const createdAt = new Date(); // Use client-side timestamp

    // Create application document to store in jobApplications collection
    const jobApplication = {
      id: applicationId,
      jobId: jobId,
      studentId: student.id,
      form: sanitizedForm, // Use sanitized form without empty keys
      createdAt: serverTimestamp(),
      status: "Pending",
    };

    // Add to jobApplications collection
    await addDoc(collection(db, "jobApplications"), jobApplication);

    // Update the job's application count and add to applications array
    await updateDoc(jobRef, {
      applicantsNo: increment(1),
      applications: arrayUnion({
        id: applicationId,
        student: student.id,
        createdAt: createdAt.toISOString(),
      }),
    });

    res.status(200).json({
      statusCode: 200,
      message: "Application submitted successfully",
      applicationId,
    });
  } catch (error) {
    console.error("Error applying for job:", error);
    next(error);
  }
};

