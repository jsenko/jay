/** References between items: a field declared with x-fyi-ref must resolve. */

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/** Exercises reference checks on capture, update and links. */
export async function run(): Promise<void> {
  section("refs");

  const c = await connect(tempStore("refs"));

  const project = await call(c, "fyi_capture", { type: "project", title: "GitOps", description: "x", slug: "gitops" });
  const note = await call(c, "fyi_capture", { type: "note", title: "A note", content: "x" });

  const ok = await call(c, "fyi_capture", { type: "task", title: "t", next_action_at: dayOffset(1), project: project.id });
  check("a reference to an existing project is accepted", ok.error === undefined, ok);

  const typo = await call(c, "fyi_capture", { type: "task", title: "t", next_action_at: dayOffset(1), project: "project-gitopz" });
  check("a reference to nothing is refused", typo.error?.includes('no item with id "project-gitopz"'), typo);

  const wrongType = await call(c, "fyi_capture", { type: "note", title: "n", content: "x", project: note.id });
  check("a reference to the wrong type is refused", wrongType.error?.includes("is a note, not a project"), wrongType);

  const badLink = await call(c, "fyi_capture", {
    type: "note", title: "n", content: "x", links: [{ id: "task-nope", rel: "relates-to" }],
  });
  check("links are checked too", badLink.error?.includes("links.id"), badLink);

  const anyLink = await call(c, "fyi_capture", {
    type: "note", title: "n", content: "x", links: [{ id: note.id, rel: "relates-to" }],
  });
  check("a link may point at any type", anyLink.error === undefined, anyLink);

  const badUpdate = await call(c, "fyi_update", { id: ok.id, project: "project-nope" });
  check("updates are checked", badUpdate.error?.includes("no item with id"), badUpdate);

  const unrelated = await call(c, "fyi_update", { id: ok.id, priority: "low" });
  check("an update not touching references is not blocked by them", unrelated.error === undefined, unrelated);

  await c.close();
}
