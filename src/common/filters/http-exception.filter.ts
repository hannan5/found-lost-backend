import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import { AppException, type ErrorBody, type ErrorCode } from "../errors/app.exception";

interface NormalizedError {
  status: number;
  body: ErrorBody;
}

const CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function codeForStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? "INTERNAL";
}

function messageFromNestResponse(response: string | object, fallback: string): string {
  if (typeof response === "string") return response;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join(" ");
  if (typeof message === "string") return message;
  return fallback;
}

/**
 * Global filter. Every error leaves the API as `{ error: { code, message, fields? } }`.
 * Never logs request bodies (they can contain contact details).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { status, body } = this.normalize(exception);

    if (status >= 500) {
      const detail =
        exception instanceof Error ? (exception.stack ?? exception.message) : exception;
      this.logger.error(`${request.method} ${request.originalUrl} -> ${status}`, detail);
    }

    response.status(status).json({ error: body });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), body: exception.getResponse() as ErrorBody };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2025") {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: "NOT_FOUND", message: "We couldn't find what you were looking for." },
        };
      }
      if (exception.code === "P2002") {
        return {
          status: HttpStatus.CONFLICT,
          body: { code: "CONFLICT", message: "That record already exists." },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = codeForStatus(status);
      const message = messageFromNestResponse(
        exception.getResponse(),
        status >= 500 ? "Something went wrong. Please try again." : exception.message,
      );
      return { status, body: { code, message } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    };
  }
}
