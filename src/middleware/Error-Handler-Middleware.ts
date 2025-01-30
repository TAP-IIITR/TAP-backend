import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/Custom-Error";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({ errors: err.serializeErrors() });
  }
  res.status(500).json({
    errors: [{ message: "Something went wrong" }],
  });
  next();
};
