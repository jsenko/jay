/**
 * The UserPromptSubmit hook: stamps the session's directory with the time
 * the user wrote. It prints nothing, since a prompt hook's output becomes
 * part of the prompt, and never fails the prompt.
 */

import { stampActivity } from "./file.mjs";

try {
  stampActivity(process.env.CLAUDE_PROJECT_DIR || process.cwd());
} catch {
  // A stamp that can't be written only means focus may lapse early.
}
