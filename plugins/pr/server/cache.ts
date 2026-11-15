/** Recent events and API responses, held in memory and bounded. */

import type { Event } from "./event-types.js";

/** How many events, and how many API responses, are kept. */
const MAX_ENTRIES = 100;

/** Drops the oldest entry once a map is over the bound; maps keep insertion order. */
function evictOldest<K, V>(map: Map<K, V>): void {
  if (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value!;
    map.delete(oldest);
  }
}

/**
 * An API response: the body, or null for a failure, with when it was
 * fetched and its ETag, so `github_api` can tell how old it is and
 * revalidate it cheaply.
 */
export interface CachedResponse {
  data: Record<string, any> | null;
  fetchedAt: number;
  etag?: string;
}

/** An event, and whether `get_new_events` has handed it out yet. */
interface CachedEvent {
  event: Event;
  consumed: boolean;
}

/**
 * What `get_event` and `get_new_events` serve, and what `github_api`
 * reuses. Bounded, because the server runs for weeks.
 */
export class Cache {
  private apiResponses = new Map<string, CachedResponse>();
  private events = new Map<string, CachedEvent>();

  /** A cached response: data, null for a cached failure, undefined if never fetched. */
  getApiResponse(url: string): Record<string, any> | null | undefined {
    return this.apiResponses.get(url)?.data;
  }

  /** A cached response with its age and ETag, or undefined if never fetched. */
  getApiEntry(url: string): CachedResponse | undefined {
    return this.apiResponses.get(url);
  }

  /** Whether the URL was fetched, successfully or not. */
  hasApiResponse(url: string): boolean {
    return this.apiResponses.has(url);
  }

  /** Caches a response, or null for a failure, as fetched now. */
  setApiResponse(url: string, data: Record<string, any> | null, etag?: string): void {
    this.apiResponses.delete(url);
    this.apiResponses.set(url, { data, fetchedAt: Date.now(), etag });
    evictOldest(this.apiResponses);
  }

  /** Marks a cached response as confirmed current now, after a 304. */
  touchApiResponse(url: string): void {
    const entry = this.apiResponses.get(url);
    if (entry) entry.fetchedAt = Date.now();
  }

  /** The full event, for `get_event`. */
  getEvent(eventId: string): Event | undefined {
    return this.events.get(eventId)?.event;
  }

  /** Caches a new event, not yet handed out. */
  setEvent(eventId: string, event: Event): void {
    this.events.set(eventId, { event, consumed: false });
    evictOldest(this.events);
  }

  /** Events not handed out before, marked as handed out: `get_new_events`. */
  consumeNewEvents(): { id: string; event: Event }[] {
    const result: { id: string; event: Event }[] = [];
    for (const [id, cached] of this.events) {
      if (!cached.consumed) {
        cached.consumed = true;
        result.push({ id, event: cached.event });
      }
    }
    return result;
  }

  /** When the oldest cached event happened, for `get_status` coverage. */
  getOldestEventTimestamp(): string | null {
    for (const cached of this.events.values()) {
      return cached.event.timestamp;
    }
    return null;
  }

  /** How many events are cached. */
  getEventCount(): number {
    return this.events.size;
  }

  /** Empties both caches. */
  clear(): void {
    this.apiResponses.clear();
    this.events.clear();
  }
}
