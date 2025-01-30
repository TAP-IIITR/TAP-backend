import { Request, Response, NextFunction } from "express";

const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Validate the request body
        Check if the user already exists
        Create a new user
        Generate a JWT token
        Set the JWT token as a cookie
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Validate the request body
        Check if the user already exists
        Generate a JWT token
        Set the JWT token as a cookie
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Clear the JWT token cookie
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Validate the request body
        Check if the user exists
        Generate a OTP and send it to the user's email
        Save the OTP in the database
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

const confirmResetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Validate the request body
        Check if the OTP is valid
        Update the user's password
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

export { register, login, logout, resetPassword, confirmResetPassword };
