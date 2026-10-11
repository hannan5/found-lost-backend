import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { type AdminItem } from "../../common/lib/mappers";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type AdminListItemsQuery,
  adminListItemsQuerySchema,
  type UpdateReviewStatusInput,
  updateReviewStatusSchema,
} from "./items.schemas";
import { ItemsService, type ListResult } from "./items.service";

/** Admin routes. Bearer token with role ADMIN required on every handler. */
@Controller("admin/items")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminItemsController {
  constructor(private readonly items: ItemsService) {}

  /** GET /api/admin/items?q=&category=&reviewStatus= */
  @Get()
  list(
    @Query(new ZodValidationPipe(adminListItemsQuerySchema)) query: AdminListItemsQuery,
  ): Promise<ListResult<AdminItem>> {
    return this.items.listAdmin(query);
  }

  /** GET /api/admin/items/:id */
  @Get(":id")
  async get(@Param("id") id: string): Promise<{ data: AdminItem }> {
    return { data: await this.items.getAdmin(id) };
  }

  /** PATCH /api/admin/items/:id/status  body { reviewStatus } */
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateReviewStatusSchema)) body: UpdateReviewStatusInput,
  ): Promise<{ data: AdminItem }> {
    return { data: await this.items.updateReviewStatus(id, body) };
  }

  /** POST /api/admin/items/:id/return */
  @Post(":id/return")
  @HttpCode(HttpStatus.OK)
  async markReturned(@Param("id") id: string): Promise<{ data: AdminItem }> {
    return { data: await this.items.markReturned(id) };
  }
}
