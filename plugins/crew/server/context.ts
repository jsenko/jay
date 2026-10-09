/**
 * Per-process session context.
 *
 * One server process serves exactly one Claude Code session, so its
 * identity is process-wide state rather than something threaded through
 * every call. Shutdown handlers need it too, which is why it lives here
 * instead of inside a tool handler.
 */

/** The session's home directory: the cwd this server inherited. */
export const HOME_DIR = process.cwd();

let sessionId: string | null = null;

/** The joined session's id, or null before `crew_join`. */
export function getSessionId(): string | null {
  return sessionId;
}

/** Set on join, cleared on leave. */
export function setSessionId(id: string | null): void {
  sessionId = id;
}

export type NotificationMode = "channel" | "poll";

let notificationMode: () => NotificationMode = () => "poll";

/**
 * Injected by the server once the MCP handshake has completed, since
 * client capabilities are not known until then.
 */
export function setNotificationModeProvider(provider: () => NotificationMode): void {
  notificationMode = provider;
}

/**
 * Whether the client accepts push notifications. Decided from the
 * handshake rather than guessed by the model (SPEC.md §1); "poll" is the
 * safe answer when unknown.
 */
export function getNotificationMode(): NotificationMode {
  return notificationMode();
}
