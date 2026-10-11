// Copied from ../Lost-FInd/src/lib/format.ts. Keep the rules identical; the
// frontend validates with these first and expects the API to agree.

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Today's date as "YYYY-MM-DD" in UTC, matching `new Date().toISOString().slice(0, 10)`. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True for a well-formed "YYYY-MM-DD" that is a real calendar date. */
export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Date strings compare correctly as plain strings when both are "YYYY-MM-DD". */
export function isNotAfterToday(value: string): boolean {
  return value <= todayUtc();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
