import { CustomError } from "./Custom-Error";

export class NotFoundError extends CustomError {
  statusCode = 404;
  constructor(message: string) {
    super(message);
  }
  serializeErrors() {
    return [{ message: this.message }];
  }
}
