import { CustomError } from "./Custom-Error";

export class AuthError extends CustomError {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
  serializeErrors() {
    return [{ message: this.message }];
  }
}
