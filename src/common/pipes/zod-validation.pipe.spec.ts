import { z } from "zod";
import { AppException } from "../errors/app.exception";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    name: z.string({ error: "Add a name." }).trim().min(1, { error: "Add a name." }),
    count: z.coerce.number().int().default(1),
  });
  const pipe = new ZodValidationPipe(schema);

  it("returns the parsed, transformed value", () => {
    expect(pipe.transform({ name: "  Watch ", count: "3" })).toEqual({ name: "Watch", count: 3 });
  });

  it("applies defaults when the body is missing", () => {
    expect(() => pipe.transform(undefined)).toThrow(AppException);
    expect(pipe.transform({ name: "x" })).toEqual({ name: "x", count: 1 });
  });

  it("throws VALIDATION_ERROR with one message per field", () => {
    try {
      pipe.transform({ name: "" });
      fail("expected the pipe to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const appError = error as AppException;
      expect(appError.getStatus()).toBe(400);
      expect(appError.code).toBe("VALIDATION_ERROR");
      expect(appError.fields).toEqual({ name: "Add a name." });
    }
  });
});
