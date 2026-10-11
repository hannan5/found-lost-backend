import { Injectable, type PipeTransform } from "@nestjs/common";
import { type z, type ZodType } from "zod";
import { AppException, type FieldErrors } from "../errors/app.exception";

/**
 * Usage: `@Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput`.
 * On failure throws 400 VALIDATION_ERROR with `fields` keyed by the schema's
 * field names, which match the frontend form state.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;

    const fields: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join(".") || "_";
      if (!(key in fields)) fields[key] = issue.message;
    }
    throw AppException.validation("Please check the highlighted fields.", fields);
  }
}
