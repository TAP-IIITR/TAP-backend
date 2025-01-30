import { Request, Response, NextFunction } from "express";

const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Get the user's dashboard data
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

const updateResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /*
        Update the user's resume
        Send the response
    */
  } catch (error) {
    next(error);
  }
};

export { getDashboard, updateResume };