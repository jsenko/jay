/**
 * The timer tools and the session events they depend on, as opencode
 * plugin hooks: a tool call knows its session, and the SDK client sends
 * the prompt into it later.
 */

import { tool } from "@opencode-ai/plugin";

import { rootSession } from "./root.mjs";
import { Timers } from "./timers.mjs";

/** Hooks for one opencode process, sending through its SDK `client`. */
export function timerHooks(client) {
  const timers = new Timers(async (session, text, agent) => {
    const result = await client.session.promptAsync({
      path: { id: session },
      body: { ...(agent ? { agent } : {}), parts: [{ type: "text", text }] },
    });
    if (result.error) throw new Error(JSON.stringify(result.error));
  });
  const z = tool.schema;
  /** The session a call's timers belong to: its top-level one, for a subagent. */
  const owner = (ctx) =>
    rootSession(ctx.sessionID, async (id) => {
      const result = await client.session.get({ path: { id } });
      if (result.error) throw new Error(JSON.stringify(result.error));
      return result.data?.parentID;
    });

  return {
    tool: {
      timer_set: tool({
        description:
          "Send a prompt into this session later, once or repeating. Setting a name that exists replaces it. " +
          "A prompt due while the session is busy waits until it is idle, and arrives marked [timer <name>]. " +
          "Called from a subagent, the timer belongs to the session that started it.",
        args: {
          name: z.string().min(1).describe("The timer's name, unique in this session, such as poll"),
          minutes: z.number().positive().describe("Minutes until it fires, and between firings with repeat"),
          prompt: z.string().min(1).describe("What to send, written as an instruction to this session"),
          repeat: z.boolean().optional().describe("Fire every `minutes` until cancelled; default once"),
        },
        async execute(args, ctx) {
          const session = await owner(ctx);
          const own = session === ctx.sessionID;
          // A subagent's agent isn't the parent's, so the parent's prompt runs under its default.
          const replaced = timers.set(session, { ...args, agent: own ? ctx.agent : undefined });
          const when = args.repeat ? `every ${args.minutes} minutes` : `in ${args.minutes} minutes`;
          const where = own ? "" : " It will arrive in the session that started this subagent, not here.";
          return `${replaced ? "Replaced" : "Set"} timer ${args.name}: fires ${when}.${where}`;
        },
      }),
      timer_cancel: tool({
        description: "Cancel one of this session's timers by name.",
        args: { name: z.string().min(1) },
        async execute({ name }, ctx) {
          return timers.cancel(await owner(ctx), name) ? `Cancelled timer ${name}.` : `No timer named ${name}.`;
        },
      }),
      timer_list: tool({
        description: "List this session's timers, soonest first.",
        args: {},
        async execute(_args, ctx) {
          return JSON.stringify(timers.list(await owner(ctx)));
        },
      }),
    },

    event: async ({ event }) => {
      if (event.type === "session.status") {
        timers.status(event.properties.sessionID, event.properties.status.type !== "idle");
      } else if (event.type === "session.idle") {
        timers.status(event.properties.sessionID, false);
      } else if (event.type === "session.deleted") {
        timers.forget(event.properties.info.id);
      }
    },
  };
}
