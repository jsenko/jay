import type { Event } from "./event-types.js";

export interface FilterResult {
  filtered: boolean;
  reason: string;
}

export type EventFilter = (event: Event) => FilterResult | null;

const PASS = null;

const IGNORED_ACTORS = new Set([
  "EricWittbot",
]);

export function filterIgnoredActors(event: Event): FilterResult | null {
  if (event.type === "WorkflowRunEvent" || event.type === "NotificationEvent") return PASS;
  if (IGNORED_ACTORS.has(event.actor)) {
    return { filtered: true, reason: `ignored actor: ${event.actor}` };
  }
  return PASS;
}

export const filters: EventFilter[] = [
  filterIgnoredActors,
];

export function applyFilters(event: Event, authenticatedUser: string): FilterResult | null {
  if (authenticatedUser && event.body.includes(`@${authenticatedUser}`)) {
    return PASS;
  }

  for (const filter of filters) {
    const result = filter(event);
    if (result) return result;
  }
  return PASS;
}
