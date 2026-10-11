import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { type PublicItem } from "../../common/lib/mappers";
import { ImageFilePipe, type UploadedImage } from "../../common/pipes/image-file.pipe";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type CreateItemInput,
  createItemSchema,
  type ListItemsQuery,
  listItemsQuerySchema,
} from "./items.schemas";
import { ItemsService, type ListResult } from "./items.service";

/** Public routes. No auth. Only ever returns the toPublicItem() shape. */
@Controller("items")
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  /** GET /api/items?q=&category=&sort=&limit= */
  @Get()
  list(
    @Query(new ZodValidationPipe(listItemsQuerySchema)) query: ListItemsQuery,
  ): Promise<ListResult<PublicItem>> {
    return this.items.listPublic(query);
  }

  /** GET /api/items/:id */
  @Get(":id")
  async get(@Param("id") id: string): Promise<{ data: PublicItem }> {
    return { data: await this.items.getPublic(id) };
  }

  /** POST /api/items (multipart/form-data, optional `image` file) -> 201 */
  @Post()
  @UseInterceptors(FileInterceptor("image"))
  async create(
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput,
    @UploadedFile(new ImageFilePipe("image")) image?: UploadedImage,
  ): Promise<{ data: PublicItem }> {
    return { data: await this.items.create(body, image) };
  }
}
