import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response } from "express";

const getAllRecruiters: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /*
        Get all recruiters

        Returns:
            - recruiters array with basic details(sort by isVerified(False first))

        Errors: 
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Internal Server Error(500)
    */
}

const getRecruiterById: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /* 
        Get recruiter by ID
        
        Parameters:
        - id: UUID (from req.params)

        Returns:
        - detailed recruiter information

        Errors:
        1. Auth Error (handled by middleware)
        2. Request Validation (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Invalid ID format (400)
        5. Recruiter not found (404)
        6. Internal Server Error (500)
    */
}

const verifyRecruiter: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /* 
        Verify a recruiter
        
        Parameters:
        - id: UUID (from req.params)

        Returns:
        - Success message

        Errors:
        1. Auth Error (handled by middleware)
        2. Request Validation (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Invalid ID format (400)
        5. Recruiter not found (404)
        6. Internal Server Error (500)
    */
}

const deleteRecruiter: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /* 
        Delete a recruiter
        
        Parameters:
        - id: UUID (from req.params)

        Returns:
        - Success message

        Errors:
        1. Auth Error (handled by middleware)
        2. Request Validation (handled by middleware)
        3. Out of bound access (User not a coordinator) (403 Forbidden)
        4. Invalid ID format (400)
        5. Recruiter not found (404)
        6. Internal Server Error (500)
    */
}

export { getAllRecruiters, getRecruiterById, verifyRecruiter, deleteRecruiter };