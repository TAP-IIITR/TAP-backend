import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response } from "express";

const getStudents: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /*
        Fetch students from the database
        Filter students based on branch and batch if provided in query params

        Errors:
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Internal Server Error(500)
    */
};

const getStudent: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {

    /*
        Fetch student from the database using ID

        Errors:
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Check if the ID is valid(400 Bad Request)
            4. Check if the student exists(404 Not Found)
            5. Internal Server Error(500)
    */
};

const getStudentApplications: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /*
        input: student ID

        Fetch all job application having the student ID = req.params.id

        Errors:
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Check if the ID is valid(400 Bad Request)
            4. Check if the student exists(404 Not Found)
            5. Internal Server Error(500)
    */
}

export { getStudents, getStudent, getStudentApplications };