import { Body, Controller, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { type CreateLostItemInput, createLostItemSchema } from "./lost-items.schemas";
import { type LostItemSummary, LostItemsService } from "./lost-items.service";

@Controller("lost-items")
export class LostItemsController {
  constructor(private readonly lostItems: LostItemsService) {}

  /** POST /api/lost-items -> 201 */
  @Post()
  async create(
    @Body(new ZodValidationPipe(createLostItemSchema)) body: CreateLostItemInput,
  ): Promise<{ data: LostItemSummary }> {
    return { data: await this.lostItems.create(body) };
  }
}
