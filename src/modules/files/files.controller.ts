import { Controller, Get, Param, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { type Response } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { AppException } from "../../common/errors/app.exception";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../integrations/storage/storage.service";

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/**
 * Serves objects from the private bucket. Item images are public because the
 * item itself is public; claim evidence is admin-only.
 */
@Controller("files")
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /** GET /api/files/items/:name */
  @Get("items/:name")
  itemImage(@Param("name") name: string, @Res({ passthrough: true }) res: Response) {
    return this.serve("items", name, res, "public, max-age=31536000, immutable");
  }

  /** GET /api/files/claims/:name (admin only) */
  @Get("claims/:name")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  claimImage(@Param("name") name: string, @Res({ passthrough: true }) res: Response) {
    return this.serve("claims", name, res, "private, no-store");
  }

  private async serve(
    folder: "items" | "claims",
    name: string,
    res: Response,
    cacheControl: string,
  ): Promise<StreamableFile> {
    if (!SAFE_NAME.test(name)) throw AppException.notFound("This file could not be found.");

    const object = await this.storage.getObject(`${folder}/${name}`);
    if (!object) throw AppException.notFound("This file could not be found.");

    res.setHeader("Cache-Control", cacheControl);
    return new StreamableFile(object.body, {
      type: object.contentType,
      length: object.contentLength,
    });
  }
}
