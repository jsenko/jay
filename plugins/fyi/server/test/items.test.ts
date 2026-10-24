/** Capture, read, update and search over the item store. */

import { readFileSync } from "node:fs";

import { call, check, connect, dayOffset, listTools, section, tempStore } from "./harness.js";

/** Exercises the schema-driven path from tool definition to file on disk. */
export async function run(): Promise<void> {
  section("items");

  const store = tempStore("items");
  const c = await connect(store);

  // --- schema-generated tool definitions ----------------------------
  const tools = await listTools(c);
  const capture = tools.find((t) => t.name === "fyi_capture");
  const props = capture.inputSchema.properties;
  check("capture advertises fields from the schemas", props.next_action_at !== undefined, Object.keys(props));
  check("type-specific fields are annotated", props.next_action_at.description.startsWith("(task)"), props.next_action_at.description);
  check("common fields are not annotated", !String(props.title.description ?? "").startsWith("("), props.title.description);
  check("enums reach the tool definition", JSON.stringify(props.priority.enum) === JSON.stringify(["critical", "high", "medium", "low"]), props.priority);
  check("server-owned fields are hidden", props.created_at === undefined && props.id === undefined, Object.keys(props));
  check("a shared field with different values allows every type's", ["in-progress", "abandoned"].every((v) => props.status.enum.includes(v)), props.status);
  check("and says which values belong to which type", props.status.description.includes("project: active, paused, done, abandoned"), props.status.description);
  const where = tools.find((t) => t.name === "fyi_search").inputSchema.properties.where.properties;
  check("where says the same", where.status.description.includes("task: open"), where.status.description);

  // --- capture ------------------------------------------------------
  const task = await call(c, "fyi_capture", {
    type: "task",
    title: "Fix KafkaSQL retry on startup",
    description: "Topic metadata is not ready yet when verification runs.",
    next_action_at: dayOffset(2),
    priority: "high",
    tags: ["kafkasql"],
  });
  check("capture returns a readable id", task.id === "task-fix-kafkasql-retry-on-startup", task);

  const file = readFileSync(task.path, "utf8");
  check("file has yaml frontmatter", file.startsWith("---\n"), file.slice(0, 40));
  check("identity fields come first", file.indexOf("id:") < file.indexOf("priority:"), file.slice(0, 120));
  check("long prose is the markdown body", file.trimEnd().endsWith("Topic metadata is not ready yet when verification runs."), file);

  // --- the one hard rule --------------------------------------------
  const undated = await call(c, "fyi_capture", { type: "task", title: "Someday maybe" });
  check("a task without a next action is rejected", undated.error?.includes("next_action_at is required"), undated);
  check("rejection names the alternative", undated.error?.includes("note"), undated.error);

  // --- validation ---------------------------------------------------
  const typo = await call(c, "fyi_capture", { type: "task", title: "x", next_action_at: dayOffset(1), prioritty: "high" });
  check("unknown field is rejected", typo.error?.includes("not a field on task"), typo);
  check("rejection lists known fields", typo.error?.includes("next_action_at"), typo.error);

  const badEnum = await call(c, "fyi_capture", { type: "task", title: "x", next_action_at: dayOffset(1), priority: "urgent" });
  check("bad enum value is rejected", badEnum.error?.includes("must be one of"), badEnum);

  const badDate = await call(c, "fyi_capture", { type: "task", title: "x", next_action_at: "next tuesday" });
  check("a vague date is rejected", badDate.error?.includes("YYYY-MM-DD"), badDate);

  // --- scope is not a PR's repo -------------------------------------
  // These were one parameter once, so every PR capture was rejected as
  // an invalid storage scope.
  check("scope and repo are separate fields", props.scope.description.includes("personal") && props.repo.description.startsWith("(pr)"), { scope: props.scope, repo: props.repo });

  const pr = await call(c, "fyi_capture", {
    type: "pr", title: "fix(kafkasql): retry topic config verification",
    url: "https://github.com/acme/widgets/pull/8676", attention: true,
  });
  check("a PR captures with an Owner/Repo", pr.id !== undefined && pr.error === undefined, pr);
  check("the PR keeps its repo", (await call(c, "fyi_get", { id: pr.id })).repo === "acme/widgets");
  check("a bad storage scope is still rejected", (await call(c, "fyi_capture", { type: "note", title: "x", content: "y", scope: "nope" })).error?.includes('no scope "nope"'));

  // --- notes and projects -------------------------------------------
  const project = await call(c, "fyi_capture", {
    type: "project",
    title: "GitOps storage",
    description: "Git-backed storage for widgets.",
    work_directories: ["/home/user/repos/widgets"],
  });
  check("project captured", project.id === "project-gitops-storage", project);

  const decision = await call(c, "fyi_capture", {
    type: "note",
    title: "Chose Varnish over a custom cache",
    content: "Surrogate-Control gives per-strategy control without owning eviction.",
    project: project.id,
    tags: ["decision"],
  });
  check("decision note captured against a project", decision.id.startsWith("note-"), decision);

  // --- id collisions --------------------------------------------------
  const dup = await call(c, "fyi_capture", { type: "project", title: "GitOps storage", description: "again" });
  check("a colliding title gets a distinct id", dup.id === "project-gitops-storage-2", dup);

  // --- get ----------------------------------------------------------
  const full = await call(c, "fyi_get", { id: task.id });
  check("get returns the prose body", full.description.includes("Topic metadata"), full);
  check("get returns schema fields", full.priority === "high", full);
  check("schema defaults are applied", full.status === "open", full);

  const missing = await call(c, "fyi_get", { id: "task-nope" });
  check("unknown id is rejected", missing.error?.includes("no item with id"), missing);

  // --- update -------------------------------------------------------
  const updated = await call(c, "fyi_update", { id: task.id, status: "in-progress", next_action_at: dayOffset(5) });
  check("update reports what changed", JSON.stringify(updated.updated) === JSON.stringify(["next_action_at", "status"]), updated);

  const after = await call(c, "fyi_get", { id: task.id });
  check("update persists", after.status === "in-progress", after);
  check("update leaves other fields alone", after.priority === "high", after);
  check("update stamps updated_at", after.updated_at > after.created_at, { c: after.created_at, u: after.updated_at });

  const badUpdate = await call(c, "fyi_update", { id: task.id, status: "finished" });
  check("update validates enums too", badUpdate.error?.includes("must be one of"), badUpdate);

  const retype = await call(c, "fyi_update", { id: task.id, type: "note" });
  check("type cannot be changed by update", retype.error?.includes("fyi_convert"), retype);

  // --- search -------------------------------------------------------
  const byType = await call(c, "fyi_search", { type: ["project"] });
  check("search by type", byType.count === 2, byType);

  const byTag = await call(c, "fyi_search", { where: { tags: "decision" } });
  check("search by tag", byTag.items[0]?.id === decision.id, byTag);

  const byProject = await call(c, "fyi_search", { where: { project: project.id } });
  check("search by project", byProject.items[0]?.id === decision.id, byProject);

  const byText = await call(c, "fyi_search", { text: "surrogate-control" });
  check("search matches body text case-insensitively", byText.items[0]?.id === decision.id, byText);

  const byDate = await call(c, "fyi_search", { type: ["task"], where: { next_action_at: { before: dayOffset(10) } } });
  check("search by date range", byDate.count === 1, byDate);

  const none = await call(c, "fyi_search", { type: ["task"], where: { next_action_at: { before: dayOffset(1) } } });
  check("date range excludes out-of-range items", none.count === 0, none);

  // --- archiving ----------------------------------------------------
  await call(c, "fyi_update", { id: dup.id, archived: true });
  check("archived items drop out of search", (await call(c, "fyi_search", { type: ["project"] })).count === 1);
  check("archived items are still retrievable", (await call(c, "fyi_get", { id: dup.id })).archived === true);
  check("archived items return when asked for", (await call(c, "fyi_search", { type: ["project"], include_archived: true })).count === 2);

  await c.close();
}
