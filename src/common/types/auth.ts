import { type Role } from "@prisma/client";
import { type Request } from "express";

/** Claims stored inside the signed JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** What `request.user` holds after JwtAuthGuard runs. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
