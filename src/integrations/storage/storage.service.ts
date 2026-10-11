import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { type Readable } from "node:stream";
import { type UploadedImage } from "../../common/pipes/image-file.pipe";
import { type Env } from "../../config/env";

export type StorageFolder = "items" | "claims";

export interface StoredObject {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function extensionFor(file: UploadedImage): string {
  const known = EXTENSION_BY_MIME[file.mimetype];
  if (known) return known;
  const fromName = extname(file.originalname ?? "").toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(fromName) ? fromName : "";
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}

/**
 * Neon Object Storage through its S3-compatible API. The bucket is private, so
 * stored objects are served by FilesController at `/api/files/<key>` and the
 * URL saved on each record points there.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly appUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.client = new S3Client({
      endpoint: config.get("AWS_ENDPOINT_URL_S3", { infer: true }),
      region: config.get("AWS_REGION", { infer: true }),
      credentials: {
        accessKeyId: config.get("AWS_ACCESS_KEY_ID", { infer: true }),
        secretAccessKey: config.get("AWS_SECRET_ACCESS_KEY", { infer: true }),
      },
      forcePathStyle: true,
    });
    this.bucket = config.get("STORAGE_BUCKET", { infer: true });
    this.appUrl = config.get("APP_URL", { infer: true }).replace(/\/+$/, "");
  }

  /** Stores an in-memory Multer file and resolves to the URL the API serves it from. */
  async uploadImage(file: UploadedImage, folder: StorageFolder): Promise<string> {
    const key = `${folder}/${randomUUID()}${extensionFor(file)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );
    return this.publicUrl(key);
  }

  publicUrl(key: string): string {
    return `${this.appUrl}/api/files/${key}`;
  }

  /** Streams one object, or null when the key does not exist. */
  async getObject(key: string): Promise<StoredObject | null> {
    try {
      const output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!output.Body) return null;
      return {
        body: output.Body as Readable,
        contentType: output.ContentType ?? "application/octet-stream",
        contentLength: output.ContentLength,
      };
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
}
