/** `crew_join` — register this session on the board. */

import { getNotificationMode, HOME_DIR, setSessionId } from "../context.js";
import { detectRepo, detectRepos, isValidId, knownKey, proposeId, uniqueId } from "../identity.js";
import { ToolError } from "../errors.js";
import { greet } from "../notifications.js";
import { reapSessions, rosterEntry } from "../sessions.js";
import { mutate } from "../store.js";
import { nowIso } from "../time.js";
import { isLive, type Session } from "../types.js";
import { validateCapabilities, requireString } from "../validation.js";
import { setupWarnings } from "../warnings.js";
import { CAPABILITY_SCHEMA, type Tool } from "./tool.js";

/**
 * Registers the session, deriving directory and repositories from the
 * process rather than asking the model to discover them.
 *
 * Idempotent by directory and purpose: rejoining returns the existing
 * session. Ids are reused across restarts so older messages referencing
 * a session still resolve.
 */
async function handler(args: Record<string, any>) {
  const purpose = requireString(args.purpose, "purpose");
  const capabilities = validateCapabilities(args.capabilities);
  const extraDirs: string[] = Array.isArray(args.directories) ? args.directories : [];
  const directories = [...new Set(extraDirs.filter((d) => d !== HOME_DIR))];
  const repos = detectRepos([HOME_DIR, ...directories]);
  const repo = detectRepo(HOME_DIR);

  if (args.id !== undefined && !isValidId(String(args.id))) {
    throw new ToolError("id must match ^[a-z0-9-]+$ and be at most 30 characters");
  }

  const result = await mutate((state) => {
    reapSessions(state);
    const key = knownKey(HOME_DIR, purpose);

    if (!args.force_new) {
      const existingId = state.known_ids[key];
      const existing = existingId ? state.sessions[existingId] : undefined;
      if (existing && isLive(existing)) {
        existing.last_seen = nowIso();
        if (existing.status === "offline") existing.status = "idle";
        return { session: existing, resumed: true, state };
      }
    }

    const preferred = args.id
      ? String(args.id)
      : state.known_ids[key] ?? proposeId(purpose, HOME_DIR, repo);
    const id = uniqueId(preferred, state);

    const session: Session = {
      id,
      purpose,
      directory: HOME_DIR,
      directories,
      repos,
      capabilities,
      fallback: Boolean(args.fallback),
      status: "idle",
      activity: purpose,
      joined_at: nowIso(),
      last_seen: nowIso(),
      cursor: state.seq,
    };

    state.sessions[id] = session;
    state.known_ids[key] = id;
    return { session, resumed: false, state };
  });

  setSessionId(result.session.id);

  const others = Object.values(result.state.sessions)
    .filter((s) => s.id !== result.session.id && isLive(s))
    .map(rosterEntry);

  greet();

  const warnings = setupWarnings(result.state);
  return {
    session_id: result.session.id,
    resumed: result.resumed,
    notifications: getNotificationMode(),
    directory: HOME_DIR,
    repos: result.session.repos,
    capabilities: result.session.capabilities,
    others,
    ...(warnings.length > 0 && { warnings }),
  };
}

export const joinTool: Tool = {
  definition: {
    name: "crew_join",
    description:
      "Register this session so others can see and reach it. Directory and repositories are detected automatically: the repositories are the git checkouts in its directories, which route jobs by repository. Idempotent: rejoining the same directory with the same purpose returns the existing session. `warnings`, when present, names work no session can take: report each in one line.",
    inputSchema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "One line on what this session is for." },
        capabilities: CAPABILITY_SCHEMA,
        directories: {
          type: "array",
          items: { type: "string" },
          description: "Additional directories this session works in, beyond its home directory.",
        },
        fallback: {
          type: "boolean",
          description: "Accept work that matches no other session. Normally only one session sets this.",
        },
        id: { type: "string", description: "Override the generated session id." },
        force_new: {
          type: "boolean",
          description: "Create a second session in this directory instead of resuming.",
        },
      },
      required: ["purpose"],
    },
  },
  handler,
};
