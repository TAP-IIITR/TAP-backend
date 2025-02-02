import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { RequestValidationError } from '../errors/Request-Validation-Error';

export const validateRequest = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new RequestValidationError(errors.array());
    }
  } catch (error) {
    next(error);
  }
};
