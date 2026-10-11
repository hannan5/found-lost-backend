import { z } from "zod";

/** Required text: trimmed, non-empty, one sentence for both "missing" and "blank". */
export const requiredText = (message: string) =>
  z.string({ error: message }).trim().min(1, { error: message });

/** Optional text: trimmed, blank becomes undefined. */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * The frontend filter controls use an "All ..." first option. Accept those
 * labels as "no filter" so the UI can forward its select value as-is.
 */
const ALL_LABELS = new Set(["All", "All items", "All categories", "All statuses"]);

export const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && ALL_LABELS.has(value.trim()) ? undefined : value),
    z.enum(values).optional(),
  );
