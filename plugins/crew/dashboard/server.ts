/**
 * crew's dashboard: the sessions on the board and the work between them. The shell
 * serves the page and the menu; this file supplies the data. It is read-only.
 */

import { badges } from "./badges.js";
import { snapshot } from "./data.js";
import { serve } from "./shell/server.js";

await serve({ dir: import.meta.dirname, state: snapshot, badges });
