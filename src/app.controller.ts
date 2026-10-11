import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  /** GET /api/health. Used by the e2e smoke test and uptime checks. */
  @Get("health")
  health(): { data: { status: "ok"; uptime: number; timestamp: string } } {
    return {
      data: {
        status: "ok",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
