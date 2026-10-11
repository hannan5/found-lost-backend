import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImageFilePipe, type UploadedImage } from "../../common/pipes/image-file.pipe";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { type CreateClaimInput, createClaimSchema } from "./claims.schemas";
import { ClaimsService, type CreatedClaim } from "./claims.service";

/** Public route. No auth. Never returns claim details beyond `{ id, status }`. */
@Controller("items/:id/claims")
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  /** POST /api/items/:id/claims (multipart/form-data, optional `supportingImage`) -> 201 */
  @Post()
  @UseInterceptors(FileInterceptor("supportingImage"))
  async create(
    @Param("id") itemId: string,
    @Body(new ZodValidationPipe(createClaimSchema)) body: CreateClaimInput,
    @UploadedFile(new ImageFilePipe("supportingImage")) supportingImage?: UploadedImage,
  ): Promise<{ data: CreatedClaim }> {
    return { data: await this.claims.create(itemId, body, supportingImage) };
  }
}
