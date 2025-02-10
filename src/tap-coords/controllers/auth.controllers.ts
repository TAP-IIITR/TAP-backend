import { Request, RequestHandler, Response } from "express";
import { AuthenticatedRequest } from "../../types/express";

const login: RequestHandler = (req: Request, res: Response) => {
    /* 
        Check auth credentials
        Details in req.body
        Generate a JWT token and send it back to the client
        { id: "12432543", role: "tap" }

        Errors : 
            1. Request Validation (handled by middleware)
            2. Invalid Credentials(404)
            3. Internal Server Error(500)
    */
}

const logout: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Destroy the session
        Send a response back to the client

        Errors:
            1. Auth Error (Handled by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Internal Server Error(500)
    */
}

const resetPassword: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Send an email to the user with a reset password link

        Errors: 
            1. Auth Error(hanlded by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            2. Internal Server Error(500)
    */

}

const confirmResetPassword: RequestHandler = (req: AuthenticatedRequest, res: Response) => {
    /* 
        Check the OTP and reset the password
        Details in req.body

        Errors: 
            1. Auth Error(hanlded by middleware)
            2. Check if the user is a TAP Coordinator(req.user.role === 'tap') (403 Forbidden)
            3. Request Validation(Handled by middleware)
            4. Invalid OTP(404)
            5. Internal Server Error(500)
    */

}

export { login, logout, resetPassword, confirmResetPassword };