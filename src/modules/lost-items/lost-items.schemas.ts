import { z } from "zod";
import {
  isDateOnly,
  isNotAfterToday,
  isValidEmail,
  isValidPhone,
  todayUtc,
} from "../../common/lib/format";
import { categoryLabels } from "../../common/lib/mappers";
import { requiredText } from "../../common/lib/schema-helpers";

/** POST /api/lost-items body. No frontend form yet; same validation style as reports. */
export const createLostItemSchema = z.object({
  name: requiredText("Add a name for the item."),
  category: z.enum(categoryLabels, { error: "Choose a category." }),
  description: requiredText("Add a few identifying details."),
  location: requiredText("Add where you think it was lost."),
  reportedDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || todayUtc())
    .refine(isDateOnly, { error: "Choose a valid date." })
    .refine(isNotAfterToday, { error: "The date cannot be in the future." }),
  reporterName: requiredText("Enter your full name."),
  email: requiredText("Enter your email address.").refine(isValidEmail, {
    error: "Enter a valid email address.",
  }),
  phone: requiredText("Enter a phone number.").refine(isValidPhone, {
    error: "Enter a valid phone number.",
  }),
});
export type CreateLostItemInput = z.output<typeof createLostItemSchema>;
