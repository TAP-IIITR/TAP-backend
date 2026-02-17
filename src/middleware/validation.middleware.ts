import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { RequestValidationError } from '../errors/Request-Validation-Error';
import logger from '../utils/logger';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn(`Validation failed for ${req.method} ${req.originalUrl}`, { errors: errors.array() });
    return next(new RequestValidationError(errors.array()));
  }

  next();
};
