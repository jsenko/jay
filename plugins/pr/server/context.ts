/** What each polled source shares with the poller. */

import type { Cache } from "./cache.js";
import type { PollerConfig } from "./config.js";
import type { Event } from "./event-types.js";
import type { Health } from "./health.js";
import type { StateFile } from "./state.js";

/** Called for each event a session should hear about. */
export type EventCallback = (eventId: string, event: Event) => void;

/** The poller's state, as a source polls with it. */
export interface PollContext {
  config: PollerConfig;
  cache: Cache;
  state: StateFile;
  health: Health;
  onEvent: EventCallback;
  /** The repositories being watched, resolved from the patterns. */
  repos: string[];
  /** The authenticated user, or empty when it couldn't be determined. */
  user: string;
}
