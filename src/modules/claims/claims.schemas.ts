import { z } from "zod";
import { isValidEmail, isValidPhone } from "../../common/lib/format";
import { claimStatusLabels } from "../../common/lib/mappers";
import { optionalEnum, optionalText, requiredText } from "../../common/lib/schema-helpers";

// Error sentences copied from ../Lost-FInd/src/components/forms/claim-item-form.tsx.

/** POST /api/items/:id/claims body (multipart, optional `supportingImage` file). */
export const createClaimSchema = z.object({
  name: requiredText("Enter your full name."),
  email: requiredText("Enter your email address.").refine(isValidEmail, {
    error: "Enter a valid email address.",
  }),
  phone: requiredText("Enter a phone or WhatsApp number.").refine(isValidPhone, {
    error: "Enter a valid phone number.",
  }),
  description: requiredText("Describe the item you lost."),
  proof: requiredText("Share a detail only the owner would know."),
});
export type CreateClaimInput = z.output<typeof createClaimSchema>;

/** GET /api/admin/claims query. Mirrors AdminClaims' search box and status tabs. */
export const adminListClaimsQuerySchema = z.object({
  q: optionalText,
  status: optionalEnum(claimStatusLabels),
});
export type AdminListClaimsQuery = z.output<typeof adminListClaimsQuerySchema>;

/** PATCH /api/admin/claims/:id/status body. Only Approved / Rejected are reachable from Pending. */
export const updateClaimStatusSchema = z.object({
  status: z.enum(["Approved", "Rejected"], { error: "Choose a valid claim status." }),
});
export type UpdateClaimStatusInput = z.output<typeof updateClaimStatusSchema>;
