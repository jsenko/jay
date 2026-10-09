/** Small pieces shared by the list and the details panel; the generic ones come from the shell. */

import { chip, esc } from "/shell/format.js";

export { chip, esc, fields, link } from "/shell/format.js";

/** Splits `findings` ("2/1") into its counts, or null when absent. */
export function findings(value) {
  const match = /^(\d+)\/(\d+)$/.exec(String(value ?? ""));
  return match ? { required: Number(match[1]), optional: Number(match[2]) } : null;
}

/** Who acts on an attention item, as a reader says it. */
export const WHO_LABEL = {
  user: "You",
  author: "Author",
  maintainer: "Maintainer",
  automation: "Automation",
};

/**
 * The chips that say where a PR stands: how big it is, what the
 * automated review found, what the user and the author did, and CI.
 */
export function prChips(pr) {
  const out = [];

  const size = { trivial: "good", simple: "good", moderate: "info", complex: "warn", major: "warn" };
  if (pr.complexity) out.push(chip(pr.complexity, size[pr.complexity]));

  const f = findings(pr.findings);
  if (pr.auto_review === "reviewed") {
    if (!f) out.push(chip("reviewed", "good"));
    else if (f.required) out.push(chip(`${f.required} required · ${f.optional} optional`, "bad"));
    else out.push(chip(f.optional ? `reviewed · ${f.optional} optional` : "reviewed · clean", "good"));
  } else if (pr.auto_review === "needs-review") out.push(chip("not reviewed", "warn"));
  else if (pr.auto_review === "in-progress") out.push(chip("reviewing", "info"));
  else if (pr.auto_review === "needs-re-review") out.push(chip("re-review due", "info"));

  if (pr.draft_review) out.push(chip("draft waiting", "info"));

  const yours = { approved: ["you approved", "good"], "changes-requested": ["you asked for changes", "warn"], commented: ["you commented", "info"] };
  if (yours[pr.manual_review]) out.push(chip(...yours[pr.manual_review]));

  const author = { addressed: ["author addressed", "good"], "partially-addressed": ["partly addressed", "warn"], "not-addressed": ["not addressed", "bad"] };
  if (author[pr.author_response]) out.push(chip(...author[pr.author_response]));

  const ci = { passing: ["CI passing", "good"], failing: ["CI failing", "bad"], pending: ["CI running", ""], "needs-approval": ["CI needs approval", "warn"] };
  if (ci[pr.check_status]) out.push(chip(...ci[pr.check_status]));

  if (pr.lifecycle === "ready-to-merge") out.push(chip("ready to merge", "good"));
  if (pr.lifecycle === "merged" || pr.lifecycle === "closed") out.push(chip(pr.lifecycle));
  if (pr.stale) out.push(chip("stale", "warn"));

  return out.join("");
}

