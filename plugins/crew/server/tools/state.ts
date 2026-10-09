/** `crew_state` — update this session's status and activity. */

import { detectRepos } from "../identity.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import { validateCapabilities, validateStatus } from "../validation.js";
import { CAPABILITY_SCHEMA, type Tool } from "./tool.js";

/**
 * Applies the supplied fields; omitted ones are left alone. Doubles as a
 * heartbeat, since every tool call refreshes `last_seen`.
 */
async function handler(args: Record<string, any>) {
  const status = validateStatus(args.status);
  const capabilities =
    args.capabilities === undefined ? undefined : validateCapabilities(args.capabilities);

  return mutate((state) => {
    const session = requireOwnSession(state);

    if (status) session.status = status;
    if (typeof args.activity === "string") session.activity = args.activity;
    if (capabilities) session.capabilities = capabilities;
    if (Array.isArray(args.directories)) {
      session.directories = [
        ...new Set(args.directories.filter((d: string) => d !== session.directory)),
      ];
      session.repos = detectRepos([session.directory, ...session.directories]);
    }

    return {
      ok: true,
      status: session.status,
      activity: session.activity,
      repos: session.repos,
    };
  });
}

export const stateTool: Tool = {
  definition: {
    name: "crew_state",
    description:
      "Update this session's status or activity. Set 'focus' while the user is actively driving this session, 'busy' while working, 'idle' when free.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["idle", "busy", "focus", "offline"] },
        activity: { type: "string", description: "One or two sentences on current work." },
        capabilities: CAPABILITY_SCHEMA,
        directories: { type: "array", items: { type: "string" } },
      },
    },
  },
  handler,
};
