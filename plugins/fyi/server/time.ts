/** Timestamp helpers. Items store ISO 8601. */

/** Full precision, for created_at and updated_at. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Date only, for next_action_at and other calendar fields. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whether a date-only string is today or earlier. */
export function isDue(date: string, asOf = today()): boolean {
  return date <= asOf;
}

/** Days between two date-only strings, negative when `date` is past. */
export function daysFrom(date: string, asOf = today()): number {
  const ms = Date.parse(date) - Date.parse(asOf);
  return Math.round(ms / 86_400_000);
}
