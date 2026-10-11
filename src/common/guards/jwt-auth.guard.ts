import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppException } from "../errors/app.exception";
import { type AuthenticatedRequest, type JwtPayload } from "../types/auth";

/** Verifies `Authorization: Bearer <token>` and sets `request.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = header?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw AppException.unauthorized("Sign in to continue.");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw AppException.unauthorized("Your session has expired. Please sign in again.");
    }

    request.user = { id: payload.sub, email: payload.email, role: payload.role };
    return true;
  }
}
