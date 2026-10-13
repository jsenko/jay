/**
 * Events a session is not told about. A mention of the user always gets
 * through, whatever the filters say.
 */

import type { Event } from "./event-types.js";

/** Why an event was dropped. */
export interface FilterResult {
  filtered: boolean;
  reason: string;
}

/** A rule: a result drops the event, null lets it through. */
export type EventFilter = (event: Event) => FilterResult | null;

/** What a filter returns to let an event through. */
const PASS = null;

/** Accounts whose activity is noise to a watcher, such as the Apicurio project's bot. */
const IGNORED_ACTORS = new Set([
  "EricWittbot",
]);

/** Drops events by an ignored actor; workflow runs and notifications have no such actor. */
export function filterIgnoredActors(event: Event): FilterResult | null {
  if (event.type === "WorkflowRunEvent" || event.type === "NotificationEvent") return PASS;
  if (IGNORED_ACTORS.has(event.actor)) {
    return { filtered: true, reason: `ignored actor: ${event.actor}` };
  }
  return PASS;
}

/** Every filter, in order; the first to drop an event wins. */
export const filters: EventFilter[] = [
  filterIgnoredActors,
];

/** Whether to drop an event; null keeps it. */
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
