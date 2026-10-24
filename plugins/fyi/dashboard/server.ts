/**
 * fyi's dashboard: what needs the user today, the pull requests waiting, and the
 * projects in flight. The shell serves the page and the menu; this file supplies
 * the data and the two changes the page can make.
 */

import { complete, snooze } from "./actions.js";
import { badges } from "./badges.js";
import { snapshot } from "./data.js";
import { knownScopes } from "../server/config.js";
import { serve } from "./shell/server.js";

await serve({
  dir: import.meta.dirname,
  // A scope that has gone, remembered by a browser, shows every scope rather than failing.
  state: (params) => {
    const scope = params.get("scope");
    return snapshot(scope !== null && knownScopes().includes(scope) ? scope : "all");
  },
  badges,
  actions: {
    "/api/complete": ({ id }) => complete(String(id)),
    "/api/snooze": ({ id, days }) => snooze(String(id), Number(days) || 1),
  },
});
