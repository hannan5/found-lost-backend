import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { type AdminStats, StatsService } from "./stats.service";

@Controller("admin/stats")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /** GET /api/admin/stats */
  @Get()
  async overview(): Promise<{ data: AdminStats }> {
    return { data: await this.stats.overview() };
  }
}
