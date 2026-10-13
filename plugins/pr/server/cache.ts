import type { Event } from "./event-types.js";

const MAX_ENTRIES = 100;

function evictOldest<K, V>(map: Map<K, V>): void {
  if (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value!;
    map.delete(oldest);
  }
}

interface CachedEvent {
  event: Event;
  consumed: boolean;
}

export class Cache {
  private apiResponses = new Map<string, Record<string, any> | null>();
  private events = new Map<string, CachedEvent>();

  getApiResponse(url: string): Record<string, any> | null | undefined {
    return this.apiResponses.get(url);
  }

  hasApiResponse(url: string): boolean {
    return this.apiResponses.has(url);
  }

  setApiResponse(url: string, data: Record<string, any> | null): void {
    this.apiResponses.set(url, data);
    evictOldest(this.apiResponses);
  }

  getEvent(eventId: string): Event | undefined {
    return this.events.get(eventId)?.event;
  }

  setEvent(eventId: string, event: Event): void {
    this.events.set(eventId, { event, consumed: false });
    evictOldest(this.events);
  }

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

  getOldestEventTimestamp(): string | null {
    for (const cached of this.events.values()) {
      return cached.event.timestamp;
    }
    return null;
  }

  getEventCount(): number {
    return this.events.size;
  }

  clear(): void {
    this.apiResponses.clear();
    this.events.clear();
  }
}
