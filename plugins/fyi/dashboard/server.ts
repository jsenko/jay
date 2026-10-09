/**
 * fyi's dashboard: what needs the user today, the pull requests waiting, and the
 * projects in flight. The shell serves the page and the menu; this file supplies
 * the data and the two changes the page can make.
 */

import { complete, snooze } from "./actions.js";
import { badges } from "./badges.js";
import { snapshot } from "./data.js";
import { serve } from "./shell/server.js";
import type { Scope } from "../server/types.js";

await serve({
  dir: import.meta.dirname,
  state: (params) => snapshot((params.get("scope") as Scope | "all" | null) ?? "all"),
  badges,
  actions: {
    "/api/complete": ({ id }) => complete(String(id)),
    "/api/snooze": ({ id, days }) => snooze(String(id), Number(days) || 1),
  },
});
