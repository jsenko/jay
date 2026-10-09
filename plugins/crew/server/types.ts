/** Shared state shape for the crew coordination server. See SPEC.md §2. */

/**
 * Fixed capability set. Deliberately not free strings: a "review" vs
 * "reviews" typo would fail silently at routing time, and the symptom
 * ("nobody is available") gives no hint where to look.
 */
export const CAPABILITIES = [
  "review",
  "code",
  "watch",
  "triage",
  "ci",
  "docs",
  "release",
  "research",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type SessionStatus = "idle" | "busy" | "focus" | "offline";

/** `focus` means the user is driving this session; the router skips it. */
export interface Session {
  id: string;
  purpose: string;
  /** Home directory — the server process cwd. */
  directory: string;
  /** Additional directories this session works in. */
  directories: string[];
  /** Owner/Repo derived from directory + directories. */
  repos: string[];
  capabilities: Capability[];
  /** Receives work that matches nothing else. See SPEC.md §4. */
  fallback: boolean;
  status: SessionStatus;
  activity: string;
  joined_at: string;
  last_seen: string;
  /** Highest message seq consumed. */
  cursor: number;
}

export interface Message {
  seq: number;
  from: string;
  /** Session id, or "all". */
  to: string;
  body: string;
  at: string;
}

export type JobState =
  | "open"
  | "claimed"
  | "done"
  | "failed"
  | "stuck"
  | "expired";

export type Priority = "critical" | "high" | "normal" | "low";

export interface Job {
  id: string;
  from: string;
  body: string;
  /** Set for a directed job; unset means the pool. */
  to?: string;
  needs: Capability[];
  repo?: string;
  repo_required: boolean;
  priority: Priority;
  /** Soft reservation: only `prefer` may claim until `prefer_until`. */
  prefer?: string;
  prefer_until?: string;
  ref?: string;
  state: JobState;
  claimed_by?: string;
  lease_expires_at?: string;
  attempts: number;
  created_at: string;
  expires_at: string;
}

export interface State {
  version: 1;
  seq: number;
  sessions: Record<string, Session>;
  messages: Message[];
  jobs: Record<string, Job>;
  /**
   * "<directory>\0<purpose>" -> session id. Lets a restarted session
   * reclaim its previous id so older messages referencing it still
   * resolve.
   */
  known_ids: Record<string, string>;
}

export function emptyState(): State {
  return {
    version: 1,
    seq: 0,
    sessions: {},
    messages: [],
    jobs: {},
    known_ids: {},
  };
}

/** SPEC.md §5: backstop for sessions that died without disconnecting. */
export const STALE_MS = 45 * 60 * 1000;

export function isStale(session: Session, now = Date.now()): boolean {
  return now - Date.parse(session.last_seen) > STALE_MS;
}

/** Live means routable: present, not offline, not stale. */
export function isLive(session: Session, now = Date.now()): boolean {
  return session.status !== "offline" && !isStale(session, now);
}
