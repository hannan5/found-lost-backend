import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { type AdminClaim } from "../../common/lib/mappers";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { type ListResult } from "../items/items.service";
import {
  type AdminListClaimsQuery,
  adminListClaimsQuerySchema,
  type UpdateClaimStatusInput,
  updateClaimStatusSchema,
} from "./claims.schemas";
import { ClaimsService } from "./claims.service";

/** Admin routes. Claim details (proof, contact) are admin-only. */
@Controller("admin/claims")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  /** GET /api/admin/claims?q=&status= */
  @Get()
  list(
    @Query(new ZodValidationPipe(adminListClaimsQuerySchema)) query: AdminListClaimsQuery,
  ): Promise<ListResult<AdminClaim>> {
    return this.claims.listAdmin(query);
  }

  /** GET /api/admin/claims/:id */
  @Get(":id")
  async get(@Param("id") id: string): Promise<{ data: AdminClaim }> {
    return { data: await this.claims.getAdmin(id) };
  }

  /** PATCH /api/admin/claims/:id/status  body { status } */
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClaimStatusSchema)) body: UpdateClaimStatusInput,
  ): Promise<{ data: AdminClaim }> {
    return { data: await this.claims.updateStatus(id, body) };
  }
}
