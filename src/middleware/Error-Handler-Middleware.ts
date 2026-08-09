import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { CustomError } from "../errors/Custom-Error";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({ errors: err.serializeErrors() });
  } else if (err instanceof multer.MulterError) {
    // Multer upload errors (oversized file, wrong field name, etc.)
    res.status(400).json({ errors: [{ message: err.message }] });
  } else {
    res.status(500).json({
      errors: [{ message: err.message || "Something went wrong" }],
    });
  }
  next();
};
