/** Timestamp helpers. Crew stores ISO 8601 and renders relative. */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Human-readable age, for rosters the user reads directly. */
export function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
