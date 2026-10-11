import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AppException } from "../../common/errors/app.exception";
import { toAuthUser } from "../../common/lib/mappers";
import { type JwtPayload } from "../../common/types/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { type LoginInput } from "./auth.schemas";

export interface LoginResult {
  token: string;
  user: ReturnType<typeof toAuthUser>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const matches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !matches) {
      throw AppException.unauthorized("Incorrect email or password.");
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { token, user: toAuthUser(user) };
  }

  async me(userId: string): Promise<ReturnType<typeof toAuthUser>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.unauthorized("Your account could not be found.");
    return toAuthUser(user);
  }
}
