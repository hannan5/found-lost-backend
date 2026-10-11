import { z } from "zod";
import { isValidEmail } from "../../common/lib/format";

export const loginSchema = z.object({
  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .min(1, { error: "Enter your email address." })
    .refine(isValidEmail, { error: "Enter a valid email address." })
    .transform((value) => value.toLowerCase()),
  password: z.string({ error: "Enter your password." }).min(1, { error: "Enter your password." }),
});

export type LoginInput = z.output<typeof loginSchema>;
