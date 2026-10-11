import { Module } from "@nestjs/common";
import { ItemsModule } from "../items/items.module";
import { AdminClaimsController } from "./admin-claims.controller";
import { ClaimsController } from "./claims.controller";
import { ClaimsService } from "./claims.service";

@Module({
  imports: [ItemsModule],
  controllers: [ClaimsController, AdminClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
