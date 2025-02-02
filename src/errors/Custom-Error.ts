export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errors: { message: string }[] = []
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }

  serializeErrors() {
    return {
      statusCode: this.statusCode,
      errors: this.errors.length > 0 ? this.errors : [{ message: this.message }]
    };
  }
}
