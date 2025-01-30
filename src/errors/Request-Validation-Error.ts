import { CustomError } from "./Custom-Error";
import { ValidationError } from "express-validator";

export class RequestValidationError extends CustomError {
  statusCode = 400;
  constructor(public errors: ValidationError[]) {
    super("Invalid request parameters");
  }
  serializeErrors() {
    return this.errors.map((err) => ({ message: err.msg, field: err.type }));
  }
}
