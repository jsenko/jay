/** Field conditions in search: operators, dotted paths, and loud failures. */

import { call, check, connect, dayOffset, listTools, section, tempStore } from "./harness.js";

/** Exercises every operator and the refusals that stop silent mismatches. */
export async function run(): Promise<void> {
  section("where");

  const c = await connect(tempStore("where"));

  await call(c, "fyi_capture", {
    type: "task", title: "Soon", next_action_at: dayOffset(1), priority: "high", tags: ["a", "b"],
  });
  await call(c, "fyi_capture", {
    type: "task", title: "Later", next_action_at: dayOffset(20), priority: "low", tags: ["a"],
  });
  await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/10",
    attention_items: [{ type: "decide", description: "Which cache?" }],
    draft_review: "Looks fine.",
  });
  await call(c, "fyi_capture", {
    type: "pr", title: "chore: deps", url: "https://github.com/acme/widgets/pull/11",
    attention_items: [{ type: "review", description: "New" }],
  });

  const count = async (args: Record<string, unknown>) => (await call(c, "fyi_search", args)).count;

  // --- operators -----------------------------------------------------
  check("a value means equals", (await count({ where: { priority: "high" } })) === 1);
  check("a list means any of", (await count({ where: { priority: ["high", "low"] } })) === 2);
  check("a value against a list field matches an element", (await count({ where: { tags: "b" } })) === 1);
  check("all needs every element", (await count({ where: { tags: { all: ["a", "b"] } } })) === 1);
  check("contains is a case-insensitive substring", (await count({ where: { url: { contains: "PULL/1" } } })) === 2);
  check("before and after bound a range", (await count({ type: ["task"], where: { next_action_at: { after: dayOffset(0), before: dayOffset(5) } } })) === 1);
  check("numbers compare as numbers", (await count({ where: { number: { after: 9 } } })) === 2);
  check("exists finds present fields", (await count({ where: { draft_review: { exists: true } } })) === 1);
  check("exists: false finds absent ones", (await count({ type: ["pr"], where: { draft_review: { exists: false } } })) === 1);
  check("a number matches its text form", (await count({ where: { number: "10" } })) === 1);

  // --- dotted paths reach into lists ---------------------------------
  check("a dotted path matches any list element", (await count({ where: { "attention_items.type": "decide" } })) === 1);
  check("conditions combine with AND", (await count({ where: { repo: "acme/widgets", number: 11 } })) === 1);

  // --- refusals -------------------------------------------------------
  const typo = await call(c, "fyi_search", { where: { priorty: "high" } });
  check("an unknown field is refused", typo.error?.includes('"priorty" is not a field'), typo);

  const wrongType = await call(c, "fyi_search", { type: ["note"], where: { lifecycle: "merged" } });
  check("a field the searched types lack is refused", wrongType.error?.includes("not a field on note"), wrongType);

  const badOp = await call(c, "fyi_search", { where: { priority: { equals: "high" } } });
  check("an unknown operator is refused", badOp.error?.includes('unknown operator "equals"'), badOp);

  const oldStyle = await call(c, "fyi_search", { tags: ["a"] });
  check("an old top-level filter is refused, pointing at where", oldStyle.error?.includes("where"), oldStyle);

  // --- the model is told the field names -----------------------------
  const search = (await listTools(c)).find((t) => t.name === "fyi_search");
  const props = search.inputSchema.properties.where.properties;
  check("where advertises fields from the schemas", props.next_action_at !== undefined, Object.keys(props));
  check("where advertises nested paths", props["attention_items.type"]?.description.includes("decide"), props["attention_items.type"]);
  check("where annotates type-specific fields", props.lifecycle?.description.startsWith("(pr)"), props.lifecycle);

  await c.close();
}
