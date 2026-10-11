import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { type AuthUser } from "../../common/types/auth";
import { type LoginInput, loginSchema } from "./auth.schemas";
import { AuthService, type LoginResult } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ): Promise<{ data: LoginResult }> {
    return { data: await this.auth.login(body) };
  }

  /** GET /api/auth/me */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<{ data: LoginResult["user"] }> {
    return { data: await this.auth.me(user.id) };
  }
}
