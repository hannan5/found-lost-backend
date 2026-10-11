import { HttpException, HttpStatus } from "@nestjs/common";

export type ErrorCode =
  "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "INTERNAL";

/** Field name -> message. Keys match the frontend form state so errors show inline. */
export type FieldErrors = Record<string, string>;

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields?: FieldErrors;
}

/**
 * The only exception services and controllers should throw.
 * HttpExceptionFilter turns it into `{ error: { code, message, fields } }`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly fields?: FieldErrors;

  constructor(code: ErrorCode, status: number, message: string, fields?: FieldErrors) {
    const body: ErrorBody = fields ? { code, message, fields } : { code, message };
    super(body, status);
    this.code = code;
    this.fields = fields;
  }

  static validation(message: string, fields?: FieldErrors): AppException {
    return new AppException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, message, fields);
  }

  static notFound(message = "We couldn't find what you were looking for."): AppException {
    return new AppException("NOT_FOUND", HttpStatus.NOT_FOUND, message);
  }

  static unauthorized(message = "Sign in to continue."): AppException {
    return new AppException("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = "You do not have access to this resource."): AppException {
    return new AppException("FORBIDDEN", HttpStatus.FORBIDDEN, message);
  }

  static conflict(message: string): AppException {
    return new AppException("CONFLICT", HttpStatus.CONFLICT, message);
  }

  static internal(message = "Something went wrong. Please try again."): AppException {
    return new AppException("INTERNAL", HttpStatus.INTERNAL_SERVER_ERROR, message);
  }
}
