import { z } from "zod";
import { isDateOnly, isNotAfterToday, isValidEmail, isValidPhone } from "../../common/lib/format";
import { categoryLabels, reviewStatusLabels } from "../../common/lib/mappers";
import { optionalEnum, optionalText, requiredText } from "../../common/lib/schema-helpers";

// Error sentences are copied from ../Lost-FInd/src/components/forms/report-item-form.tsx
// so the UI can show server errors without a mapping layer.

export const createItemSchema = z.object({
  name: requiredText("Add a name for the item."),
  category: z.enum(categoryLabels, { error: "Choose a category." }),
  description: requiredText("Add a few identifying details."),
  location: requiredText("Add where it was found."),
  foundDate: z
    .string({ error: "Choose the date it was found." })
    .trim()
    .min(1, { error: "Choose the date it was found." })
    .refine(isDateOnly, { error: "Choose the date it was found." })
    .refine(isNotAfterToday, { error: "The date found cannot be in the future." }),
  reporterName: requiredText("Enter your full name."),
  email: requiredText("Enter your email address.").refine(isValidEmail, {
    error: "Enter a valid email address.",
  }),
  phone: requiredText("Enter a phone number.").refine(isValidPhone, {
    error: "Enter a valid phone number.",
  }),
  whatsapp: optionalText.refine((value) => !value || isValidPhone(value), {
    error: "Enter a valid WhatsApp number.",
  }),
});
export type CreateItemInput = z.output<typeof createItemSchema>;

export const sortOrders = ["newest", "oldest", "name"] as const;
export type SortOrder = (typeof sortOrders)[number];

/** GET /api/items query. Mirrors FoundItemsBrowser's search, category row and sort select. */
export const listItemsQuerySchema = z.object({
  q: optionalText,
  category: optionalEnum(categoryLabels),
  sort: z.enum(sortOrders).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListItemsQuery = z.output<typeof listItemsQuerySchema>;

/** GET /api/admin/items query. Mirrors AdminFoundItems' search box and two selects. */
export const adminListItemsQuerySchema = z.object({
  q: optionalText,
  category: optionalEnum(categoryLabels),
  reviewStatus: optionalEnum(reviewStatusLabels),
});
export type AdminListItemsQuery = z.output<typeof adminListItemsQuerySchema>;

/** PATCH /api/admin/items/:id/status body. */
export const updateReviewStatusSchema = z.object({
  reviewStatus: z.enum(reviewStatusLabels, { error: "Choose a valid review status." }),
});
export type UpdateReviewStatusInput = z.output<typeof updateReviewStatusSchema>;
