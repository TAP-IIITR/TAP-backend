import { AuthenticatedRequest } from "../../types/express";
import { Response, RequestHandler } from "express"

const createJob: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Create a new job listing
        
        Required fields in req.body:
        - title: string
        - JD: string
        - location: string
        - package: string
        - eligibility: string
        - skills: string[]
        - deadline: Date
        - form: JSON
        - recruiter: UUID

        Errors:
        1. Auth Error (handled by middleware)
        2. Out of Bound access(user not a TAP coordinator) (403 Forbidden)
        3. Request Validation (400) (handled by middleware)
        4. Recruiter not found (404)
        5. Internal Server Error (500)
    */
}

const getAllJobs: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Fetch all jobs

        Returns:
        - jobs array with basic details(sort by createdAt(Newest first))

        Errors:
        1. Auth Error (handled by middleware)
        2. Check if the user is a TAP coordinator (403)
        3. Internal Server Error (500)
    */
}

const getJobById: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Fetch specific job details by ID
        
        Parameters:
        - id: UUID (from req.params)

        Returns:
        - detailed job information

        Errors:
        1. Auth Error (handled by middleware)
        2. Request Validation (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Invalid ID format (400)
        5. Job not found (404)
        6. Internal Server Error (500)
    */
}

const updateJob: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Update existing job details
        
        Parameters:
        - id: UUID (from req.params)

        Optional fields in req.body:
        - title: string
        - JD: string
        - location: string
        - package: string
        - eligibility: string
        - skills: string[]
        - deadline: Date

        Errors:
        1. Auth Error (handled by middleware)
        2. Request Validation (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Job not found (404)
        5. Internal Server Error (500)
    */
}

const deleteJob: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Delete a job listing
        
        Parameters:
        - id: UUID (from req.params)

        Errors:
        1. Auth Error (handled by middleware)
        2. Invalid ID format (400) (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Job not found (404)
        5. Internal Server Error (500)
    */
}

const getAllApplications: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Input - job: UUID(req.query)

        Get Job from DB using job ID
        Iterate through applications array and Application details
        
        Returns:
        - Array of applications

        Errors:
        1. Auth Error (handled by middleware)
        2. Out of bound access (User not a coordinator) (403 Forbidden)
        3. Internal Server Error (500)
    */
}

export { createJob, getAllJobs, getJobById, updateJob, deleteJob, getAllApplications };