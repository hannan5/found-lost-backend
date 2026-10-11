import { SetMetadata } from "@nestjs/common";
import { type Role } from "@prisma/client";

export const ROLES_KEY = "roles";

/** `@Roles("ADMIN")` on a controller or handler. Checked by RolesGuard. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
