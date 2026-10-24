// opencode's entry for this plugin: the shared adapter, given this folder,
// and the timer tools, which only opencode gets.
import { jayPlugin } from "./opencode/adapter.mjs";
import { timerHooks } from "./timer/hooks.mjs";

const adapter = jayPlugin(import.meta.dirname);

export const JayTimer = async (input) => ({ ...(await adapter(input)), ...timerHooks(input.client) });
