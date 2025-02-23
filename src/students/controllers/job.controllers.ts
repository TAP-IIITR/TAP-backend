import { Request, Response, NextFunction } from "express";
import {
  collection,
  getDocs,
  query as q,
  where,
  updateDoc,
  addDoc,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

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
      jobsData.push({ id: docSnapshot.id, ...docSnapshot.data() });
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

export const getJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    let applications = [];
    if (jobData.applications && Array.isArray(jobData.applications)) {
      applications = jobData.applications.map((app: any) => ({ form: app.form }));
    }
    
    res.status(200).json({
      statusCode: 200,
      message: "Job fetched",
      job: { id: jobDoc.id, ...jobData, applications }
    });
  } catch (error) {
    next(error);
  }
};

// POST /jobs/:id/apply

export const applyJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;
    const jobsQuery = q(collection(db, "jobs"), where("job_id", "==", jobId));
    const querySnapshot = await getDocs(jobsQuery);
    if (querySnapshot.empty) {
      res.status(404).json({ success: false, message: "Job not found or has expired" });
      return;
    }
    const jobDoc = querySnapshot.docs[0];
    const jobDocRef = jobDoc.ref;

    // todo - ADD ADMIN MIDDLEWARE
    // if (!admin) {
    //   res.status(401).json({ success: false, message: "Unauthorized" });
    //   return;
    // }

    const student = (req as any).user;
    
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

    const jobApplication = {
      uuid: uuidv4(),
      job: jobId,
      student: student.id,
      form: jobApplicationForm,
      createdAt: new Date(), 
      status: "Pending"
    };


    try {
        // Try updating the job document by appending the new application
        await updateDoc(jobDocRef, {
          applications: arrayUnion(jobApplication)
        });
        console.log("Application successfully added.");
      } catch (error) {
        // Log the error to identify if it's a permission issue or another error
        console.error("Error updating document:", error);
        throw error; // rethrow so that the error middleware can handle it if needed
      }

    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: Number(process.env.EMAIL_PORT) || 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS
    //   }
    // });

    // const mailOptions = {
    //   from: process.env.EMAIL_FROM || '"No Reply" <no-reply@example.com>',
    //   to: student.email,
    //   subject: "Job Application Confirmation",
    //   text: `Hello, your application for the job has been received.`,
    //   html: `<p>Hello,</p><p>Your application for the job has been received.</p>`
    // };

    // await transporter.sendMail(mailOptions);

    res.status(200).json({
      statusCode: 200,
      message: "Application submitted and confirmation email sent",
      jobApplication
    });
    
  } catch (error) {
    next(error);
  }
};

// POST /jobs/admin

export const addJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, jd, location, salaryPackage, eligibility, skills, deadline, recruiter, job_type, form } = req.body;

    if (!title || !jd || !location || !salaryPackage || !eligibility || !skills || !deadline || !recruiter || !job_type) {
      res.status(400).json({ success: false, message: "Missing required job fields" });
      return;
    }

    const newJob: any = {
      title,
      jd,
      location,
      package: salaryPackage,
      eligibility,
      skills,
      deadline,
      recruiter,
      job_type,
      applications: [],
      createdAt: serverTimestamp()
    };

    // ✅ Ensure form is only added if it exists
    if (form !== undefined) {
      newJob.form = form;
    }

    const jobRef = await addDoc(collection(db, "jobs"), newJob);
    await updateDoc(jobRef, { job_id: jobRef.id });

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      job_id: jobRef.id
    });
  } catch (error) {
    next(error);
  }
};
