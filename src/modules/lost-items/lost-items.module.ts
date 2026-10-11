import { Module } from "@nestjs/common";
import { LostItemsController } from "./lost-items.controller";
import { LostItemsService } from "./lost-items.service";

@Module({
  controllers: [LostItemsController],
  providers: [LostItemsService],
})
export class LostItemsModule {}
