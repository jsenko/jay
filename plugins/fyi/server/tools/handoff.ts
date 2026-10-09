/** `fyi_handoff` — assemble enough context to continue a project. */

import { ToolError } from "../errors.js";
import { search, summarise } from "../query.js";
import { all, get } from "../store.js";
import { daysFrom } from "../time.js";
import type { Tool } from "./tool.js";

/** Statuses that take a task out of the running. */
const CLOSED = ["done", "cancelled"];

/** How many decision notes to carry. Enough for context, not a history. */
const DEFAULT_NOTES = 10;

/**
 * The replacement for resuming a session.
 *
 * A session is a process bound to a directory and cannot reappear
 * elsewhere, but a project's work directories are many-to-many — so this
 * assembles from the project and works from anywhere. Deliberately short:
 * the point is less context than a transcript, but the right context.
 */
function handler(args: Record<string, any>) {
  const id = String(args.project ?? "").trim();
  if (!id) throw new ToolError("project is required");

  const stored = get(id);
  if (!stored) throw new ToolError(`no item with id "${id}"`);
  if (stored.item.type !== "project") {
    throw new ToolError(`"${id}" is a ${stored.item.type}; handoff works on a project`);
  }

  const project = stored.item;
  // An archived project's notes left with it, so look where they went.
  const archived = project.archived === true;
  const items = all(archived);
  const limit = Number(args.notes) || DEFAULT_NOTES;

  const tasks = search(items, { type: "task", where: { project: id }, scope: stored.scope, include_archived: archived }).filter(
    (s) => !CLOSED.includes(String(s.item.status ?? "open"))
  );

  const notes = search(items, { type: "note", where: { project: id }, scope: stored.scope, include_archived: archived })
    .sort((a, b) => String(b.item.created_at).localeCompare(String(a.item.created_at)))
    .slice(0, limit);

  const repos = (project.repos as string[] | undefined) ?? [];
  const prs = search(items, { type: "pr", scope: stored.scope }).filter((s) => repos.includes(String(s.item.repo)));

  const stateAge = project.current_state_at
    ? -daysFrom(String(project.current_state_at).slice(0, 10))
    : null;

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      description: project.description,
      work_directories: project.work_directories,
    },
    // Where progress is really recorded, when the project has issues.
    // fyi does not fetch them; the caller checks them before trusting
    // current_state, because when they disagree the issue is right.
    issues: project.issues ?? [],
    // Stale state presented confidently is worse than none, so its age
    // travels with it.
    current_state: project.current_state ?? null,
    current_state_age_days: stateAge,
    open_tasks: tasks.map(summarise),
    recent_decisions: notes.map((s) => ({
      id: s.item.id,
      title: s.item.title,
      at: String(s.item.created_at).slice(0, 10),
      content: s.item.content,
    })),
    tracked_prs: prs.map(summarise),
  };
}

export const handoffTool: Tool = {
  definition: {
    name: "fyi_handoff",
    description:
      "Pick up a project where the last session left off: what it is, where work stopped, what decisions were made and why, what is still open. Works from any directory — use this instead of trying to resume a previous session.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project id." },
        notes: { type: "number", description: "How many recent decisions to include. Defaults to 10." },
      },
      required: ["project"],
    },
  },
  handler,
};
