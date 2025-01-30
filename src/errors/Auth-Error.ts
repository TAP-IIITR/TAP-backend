import { CustomError } from "./Custom-Error";

export class AuthError extends CustomError {
  statusCode = 401;
  constructor(message: string) {
    super(message);
  }
  serializeErrors() {
    return [{ message: this.message }];
  }
}
