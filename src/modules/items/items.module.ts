import { Module } from "@nestjs/common";
import { AdminItemsController } from "./admin-items.controller";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";

@Module({
  controllers: [ItemsController, AdminItemsController],
  providers: [ItemsService],
  // ClaimsModule needs ItemsService.findByIdOrSlug.
  exports: [ItemsService],
})
export class ItemsModule {}
