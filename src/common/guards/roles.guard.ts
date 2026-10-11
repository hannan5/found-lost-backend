import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Role } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AppException } from "../errors/app.exception";
import { type AuthenticatedRequest } from "../types/auth";

/** Reads `@Roles()` metadata. Must run after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw AppException.unauthorized();
    if (!required.includes(user.role)) throw AppException.forbidden();
    return true;
  }
}
