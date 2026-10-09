/**
 * The right column: everything about one item.
 *
 * Long text lives here rather than in the list — a PR's summary, a
 * draft review, a project's saved state — so rows stay short.
 */

import { WHO_LABEL, chip, esc, fields, findings, link, prChips } from "./format.js";

/** Attention items, grouped by whose move they are, the user's first. */
function attention(items) {
  if (!items.length) return "";
  const order = ["user", "author", "maintainer", "automation"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.who) - order.indexOf(b.who));
  return `<h4>Attention</h4>${sorted
    .map((i) => `<div class="att${i.who === "user" ? " you" : ""}"><div class="who">${WHO_LABEL[i.who]} · ${esc(i.type)}</div>${esc(i.description)}</div>`)
    .join("")}`;
}

/** A pull request. */
function pr(p) {
  const f = findings(p.findings);
  const commit = (sha) => (sha ? ` <span class="ref">at ${esc(String(sha).slice(0, 8))}</span>` : "");
  return `
    <h3>${p.url ? link(p.url, p.title) : esc(p.title)}</h3>
    <div class="chips">${prChips(p)}</div>
    ${attention(p.attention_items)}
    ${p.summary ? `<h4>Summary</h4><div class="prose">${esc(p.summary)}</div>` : ""}
    ${p.draft_review ? `<h4>Draft review</h4><details><summary>Not posted — open to read</summary><div class="prose">${esc(p.draft_review)}</div></details>` : ""}
    ${p.followups?.length ? `<h4>Optional findings, author's choice</h4>${fields(p.followups.map((x) => [x.id, `${esc(x.choice)}${x.issue ? ` · ${link(x.issue, "issue")}` : ""}`]))}` : ""}
    ${p.ci_failures?.length ? `<h4>CI failures</h4>${p.ci_failures.map((c) => `<div class="att"><div class="who">${esc(c.workflow)}${c.failed_at ? ` · ${esc(c.failed_at)}` : ""}</div>${esc(c.cause ?? "")} ${c.run_url ? link(c.run_url, "run") : ""}</div>`).join("")}` : ""}
    <h4>Details</h4>
    ${fields([
      ["PR", `${esc(p.repo)}#${esc(p.number)}`],
      ["Author", esc(p.author)],
      ["Assignee", esc(p.assignee)],
      ["Importance", esc(p.importance)],
      ["Why tracked", esc(p.triage_reason)],
      ["Lifecycle", esc(p.lifecycle)],
      ["Opened", esc(p.opened_at)],
      ["Automated review", p.auto_review ? esc(p.auto_review) + commit(p.auto_reviewed_commit) : ""],
      ["Findings", f ? `${f.required} required, ${f.optional} optional` : ""],
      ["Your review", p.manual_review ? esc(p.manual_review) + commit(p.manual_reviewed_commit) : ""],
      ["Author response", esc(p.author_response)],
      ["CI", esc(p.check_status)],
      ["Synced", p.synced_at ? esc(String(p.synced_at).slice(0, 16).replace("T", " ")) + (p.stale ? ` ${chip("stale", "warn")}` : "") : chip("never", "warn")],
      ["Id", esc(p.id)],
    ])}`;
}

/** A task. */
function task(t) {
  return `
    <h3>${esc(t.title)}</h3>
    ${fields([
      ["Next action", esc(t.next) + (t.overdue_days > 0 ? ` ${chip(`${t.overdue_days}d overdue`, "warn")}` : "")],
      ["Deadline", esc(t.due)],
      ["Priority", esc(t.priority)],
      ["Status", esc(t.status)],
      ["Blocked on", esc(t.blocked_on)],
      ["Project", esc(t.project)],
      ["Tags", (t.tags ?? []).map((x) => chip(x)).join(" ")],
      ["Store", esc(t.scope)],
      ["Id", esc(t.id)],
    ])}
    <div class="actions" style="margin: 14px 0 0">
      <button data-done="${esc(t.id)}">Done</button>
      <button data-snooze="${esc(t.id)}" data-days="1">+1 day</button>
      <button data-snooze="${esc(t.id)}" data-days="7">+1 week</button>
    </div>
    ${t.description ? `<h4>Description</h4><div class="prose">${esc(t.description)}</div>` : ""}`;
}

/** A project. */
function project(p) {
  const age = p.current_state_age;
  return `
    <h3>${esc(p.title)}</h3>
    ${p.current_state ? `<h4>Where it stopped${age !== null ? ` · ${age}d ago` : ""}</h4><div class="prose">${esc(p.current_state)}</div>` : ""}
    ${p.issues?.length ? `<h4>GitHub issues</h4>${p.issues.map((u) => `<div>${link(u)}</div>`).join("")}` : ""}
    ${p.description ? `<h4>Description</h4><div class="prose">${esc(p.description)}</div>` : ""}
    <h4>Details</h4>
    ${fields([
      ["Status", esc(p.status)],
      ["Weight", esc(p.weight)],
      ["Directories", (p.work_directories ?? []).map(esc).join("<br>")],
      ["Repositories", (p.repos ?? []).map(esc).join("<br>")],
      ["Tags", (p.tags ?? []).map((x) => chip(x)).join(" ")],
      ["Id", esc(p.id)],
    ])}`;
}

/** Finds the selected item in the snapshot, or null when it has gone. */
export function find(state, key) {
  const [kind, ...rest] = String(key).split(":");
  const id = rest.join(":");
  const pools = {
    task: [...state.tasks.due, ...state.tasks.upcoming],
    pr: state.prs,
    project: state.projects,
  };
  const item = (pools[kind] ?? []).find((x) => x.id === id);
  return item ? { kind, item } : null;
}

const RENDER = { pr, task, project };

/** The panel's heading and body for one item. */
export function render({ kind, item }) {
  const label = { pr: "Pull request", task: "Task", project: "Project" }[kind];
  return { label, html: RENDER[kind](item) };
}
