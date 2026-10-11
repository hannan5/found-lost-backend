import { Injectable, type PipeTransform } from "@nestjs/common";
import { AppException } from "../errors/app.exception";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type UploadedImage = Express.Multer.File;

/**
 * Usage: `@UploadedFile(new ImageFilePipe("image")) image?: UploadedImage`.
 * Mirrors the frontend ImageUploader rules: `image/*` and at most 8 MB.
 * The file is optional; a missing file passes through as `undefined`.
 */
@Injectable()
export class ImageFilePipe implements PipeTransform<UploadedImage | undefined> {
  constructor(private readonly field: string = "image") {}

  transform(file: UploadedImage | undefined): UploadedImage | undefined {
    if (!file) return undefined;

    if (!file.mimetype.startsWith("image/")) {
      throw AppException.validation("Please check the highlighted fields.", {
        [this.field]: "Choose an image file to continue.",
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw AppException.validation("Please check the highlighted fields.", {
        [this.field]: "Images must be smaller than 8 MB.",
      });
    }
    return file;
  }
}
