import { isDateOnly, isNotAfterToday, isValidEmail, isValidPhone, todayUtc } from "./format";

describe("format helpers (copied from the frontend)", () => {
  it("validates emails like the frontend", () => {
    expect(isValidEmail("  you@example.com ")).toBe(true);
    expect(isValidEmail("you@example")).toBe(false);
    expect(isValidEmail("you example@site.com")).toBe(false);
  });

  it("validates phone numbers by digit count 7..15", () => {
    expect(isValidPhone("+1 202-555-0101")).toBe(true);
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isDateOnly("2026-10-08")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("08/10/2026")).toBe(false);
  });

  it("rejects future dates by string comparison", () => {
    expect(isNotAfterToday(todayUtc())).toBe(true);
    expect(isNotAfterToday("2999-01-01")).toBe(false);
  });
});
