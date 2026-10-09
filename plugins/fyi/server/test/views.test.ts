/** Assembled views: today, links, handoff and conversion. */

import { call, check, connect, dayOffset, section, tempStore, today } from "./harness.js";

/** Exercises the tools that answer a question rather than store a field. */
export async function run(): Promise<void> {
  section("views");

  const store = tempStore("views");
  const c = await connect(store);

  const project = await call(c, "fyi_capture", {
    type: "project",
    title: "GitOps storage",
    description: "Git-backed storage for widgets.",
    work_directories: ["/home/user/repos/widgets"],
    repos: ["acme/widgets"],
    issues: ["https://github.com/acme/widgets/issues/8813"],
    current_state: "Phase 5b merged. Next is the conflict detection rewrite.",
    current_state_at: "2026-09-18T17:00:00.000Z",
  });

  const overdue = await call(c, "fyi_capture", {
    type: "task", title: "Rebase the phase 6 branch",
    next_action_at: dayOffset(-3), priority: "high", project: project.id,
  });
  const dueToday = await call(c, "fyi_capture", {
    type: "task", title: "Reply on issue 7499",
    next_action_at: today(), priority: "critical",
  });
  const soon = await call(c, "fyi_capture", {
    type: "task", title: "Draft the migration guide",
    next_action_at: dayOffset(3), project: project.id,
  });
  await call(c, "fyi_capture", {
    type: "task", title: "Revisit next quarter", next_action_at: dayOffset(60),
  });
  const blocked = await call(c, "fyi_capture", {
    type: "task", title: "Cut 3.3.2", next_action_at: dayOffset(-1),
    status: "blocked", blocked_on: "waiting on the release vote",
  });
  const finished = await call(c, "fyi_capture", {
    type: "task", title: "Already handled", next_action_at: dayOffset(-5), status: "done",
  });

  await call(c, "fyi_capture", {
    type: "pr", title: "fix(kafkasql): retry topic config verification",
    url: "https://github.com/acme/widgets/pull/8676", attention: true,
    attention_items: [{ type: "manual-review", description: "Ready for sign-off" }],
  });
  await call(c, "fyi_capture", {
    type: "pr", title: "chore: bump deps", url: "https://github.com/acme/widgets/pull/8700", attention: false,
  });

  // --- today --------------------------------------------------------
  const t = await call(c, "fyi_today");
  check("due includes overdue and today", t.due.length === 3, t.due.map((x: any) => x.id));
  check("most overdue comes first", t.due[0].id === overdue.id, t.due.map((x: any) => x.id));
  check("overdue days are reported", t.due[0].overdue_days === 3, t.due[0]);
  check("done tasks are excluded", !t.due.some((x: any) => x.id === finished.id), t.due);
  check("upcoming is separate from due", t.upcoming.length === 1 && t.upcoming[0].id === soon.id, t.upcoming);
  check("distant tasks are beyond the horizon", !t.upcoming.some((x: any) => x.title.includes("quarter")), t.upcoming);
  check("blocked tasks are called out", t.blocked[0]?.blocked_on === "waiting on the release vote", t.blocked);
  check("only PRs wanting attention appear", t.prs_needing_attention.length === 1, t.prs_needing_attention);
  check("active projects are listed", t.active_projects[0]?.id === project.id, t.active_projects);

  const wide = await call(c, "fyi_today", { horizon_days: 90 });
  check("horizon is adjustable", wide.upcoming.length === 2, wide.upcoming);

  // --- links --------------------------------------------------------
  const linked = await call(c, "fyi_link", { from: overdue.id, to: blocked.id, rel: "blocked-by" });
  check("link reports its inverse", linked.inverse === "blocks", linked);

  const fromSide = await call(c, "fyi_get", { id: overdue.id });
  const toSide = await call(c, "fyi_get", { id: blocked.id });
  check("link is written on the source", fromSide.links[0].rel === "blocked-by", fromSide.links);
  check("inverse is written on the target", toSide.links[0].rel === "blocks" && toSide.links[0].id === overdue.id, toSide.links);

  const selfLink = await call(c, "fyi_link", { from: overdue.id, to: overdue.id, rel: "relates-to" });
  check("self-links are rejected", selfLink.error?.includes("cannot link to itself"), selfLink);

  // --- handoff ------------------------------------------------------
  await call(c, "fyi_capture", {
    type: "note", title: "Chose per-repo branches over one branch per artifact",
    content: "Fewer refs to reconcile on conflict.", project: project.id,
  });
  await call(c, "fyi_capture", {
    type: "note", title: "Unrelated note", content: "Not about gitops.",
  });

  const h = await call(c, "fyi_handoff", { project: project.id });
  check("handoff carries where work stopped", h.current_state.includes("Phase 5b"), h.current_state);
  check("handoff reports how stale that is", typeof h.current_state_age_days === "number", h);
  check("handoff lists open project tasks", h.open_tasks.length === 2, h.open_tasks.map((x: any) => x.id));
  check("handoff carries decisions", h.recent_decisions[0].title.includes("per-repo branches"), h.recent_decisions);
  check("handoff excludes unrelated notes", h.recent_decisions.length === 1, h.recent_decisions);
  check("handoff finds PRs via the project repos", h.tracked_prs.length === 2, h.tracked_prs);
  check("handoff carries the project's issues", h.issues?.[0]?.endsWith("/issues/8813"), h.issues);

  const badIssue = await call(c, "fyi_update", { id: project.id, issues: ["https://github.com/acme/widgets/pull/1"] });
  check("an issue link must point at an issue", badIssue.error?.includes("must match"), badIssue);

  const notAProject = await call(c, "fyi_handoff", { project: overdue.id });
  check("handoff on a non-project is rejected", notAProject.error?.includes("handoff works on a project"), notAProject);

  // --- convert ------------------------------------------------------
  const note = await call(c, "fyi_capture", {
    type: "note", title: "Varnish config needs a second look",
    content: "The TTL on immutable content looks wrong.", tags: ["http-caching"],
  });

  const noDate = await call(c, "fyi_convert", { id: note.id, to: "task" });
  check("converting to a task still needs a next action", noDate.error?.includes("next_action_at is required"), noDate);

  const converted = await call(c, "fyi_convert", { id: note.id, to: "task", next_action_at: dayOffset(2) });
  check("convert creates the new type", converted.type === "task", converted);
  check("convert archives the source", converted.source_archived === true, converted);

  const asTask = await call(c, "fyi_get", { id: converted.id });
  check("prose moves to the target's field", asTask.description === "The TTL on immutable content looks wrong.", asTask);
  check("tags carry across", asTask.tags?.includes("http-caching"), asTask.tags);
  check("provenance is recorded", asTask.links.some((l: any) => l.id === note.id && l.rel === "from"), asTask.links);

  const original = await call(c, "fyi_get", { id: note.id });
  check("source is archived", original.archived === true, original);
  check("source points at its successor", original.links.some((l: any) => l.id === converted.id), original.links);
  check("archived source leaves search", (await call(c, "fyi_search", { text: "second look" })).count === 1);

  const kept = await call(c, "fyi_capture", { type: "note", title: "Keep me", content: "x" });
  const keptConv = await call(c, "fyi_convert", { id: kept.id, to: "project", description: "now a project", keep_source: true });
  check("keep_source leaves the original active", keptConv.source_archived === false, keptConv);
  check("original is still searchable", (await call(c, "fyi_get", { id: kept.id })).archived === undefined);

  const sameType = await call(c, "fyi_convert", { id: converted.id, to: "task", next_action_at: dayOffset(1) });
  check("converting to the same type is rejected", sameType.error?.includes("already a task"), sameType);

  await c.close();
}
