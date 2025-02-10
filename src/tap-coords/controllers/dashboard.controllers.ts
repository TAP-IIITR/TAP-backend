import { AuthenticatedRequest } from "../../types/express";
import { RequestHandler, Response } from "express";

export const getDashboard: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /*
        Fetch ID from req.user and use it to
        Get the dashboard data for the TAP Coordinator

        Errors: 
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Internal Server Error(500)
    */
};

export const updateCGPA: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    /*
        Input: Excel file with CGPA data
        Fetch Reg_No(also Primary Key for students) and CGPA from the excel file
        Update the CGPA of the students in the database

        // can use express-validator with multer to verify the excel file but that is inefficient in our case,
        // so we will do validation checks in the controller

        Errors:
            1. Auth Error(handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Check if the file is an excel file(400 Bad Request)
            4. Check if the file is empty(400 Bad Request)
            5. Check if the file has the required columns(400 Bad Request)
            6. Check if the Reg_No exists in the database(404 Not Found)
            7. Internal Server Error(500)
    */
}