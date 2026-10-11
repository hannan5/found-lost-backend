import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { AppException } from "../errors/app.exception";
import { type AuthenticatedRequest, type AuthUser } from "../types/auth";

/** `@CurrentUser() user: AuthUser` inside a handler protected by JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  const user: AuthUser | undefined = request.user;
  if (!user) throw AppException.unauthorized();
  return user;
});
