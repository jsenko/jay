// opencode's entry for this plugin: the shared adapter, given this folder,
// and the prompt stamp Claude Code gets from activity/hooks.json, so focus
// lapses once the user stops writing.
import { stampActivity } from "./activity/file.mjs";
import { jayPlugin } from "./opencode/adapter.mjs";

const adapted = jayPlugin(import.meta.dirname);

export const JayCrew = async (context) => ({
  ...(await adapted(context)),
  "chat.message": async () => {
    try {
      stampActivity(context.directory);
    } catch {
      // A stamp that can't be written only means focus may lapse early.
    }
  },
});
