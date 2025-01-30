import { Request, Response, NextFunction } from "express";

const getJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        /*
            Get the jobs
            Send the response
        */
    } catch (error) {
        next(error);
    }
}

const getJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        /*
            Get the job
            Send the response
        */
    } catch (error) {
        next(error);
    }
}

const applyJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        /*
            Apply for the job
            Send the response
        */
    } catch (error) {
        next(error);
    }
}

export { getJobs, getJob, applyJob }; 