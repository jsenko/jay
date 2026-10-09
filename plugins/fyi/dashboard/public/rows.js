/**
 * The middle column: one compact row per item.
 *
 * A row shows what decides whether to open it. Everything else is in the
 * details panel, so rows stay scannable however much an item carries.
 */

import { WHO_LABEL, chip, esc, prChips } from "./format.js";

/** A clickable row. `key` is `<kind>:<id>`, which the details panel opens. */
function row(key, inner, { selected, tone = "" }) {
  return `<div class="row ${tone}${selected === key ? " selected" : ""}" role="button" tabindex="0" data-select="${esc(key)}">${inner}</div>`;
}

/** A task: when, how urgent, and the two quick actions. */
function taskRow(task, selected) {
  const late = task.overdue_days > 0;
  const when = late ? chip(`${task.overdue_days}d overdue`, "warn") : chip(task.overdue_days === 0 ? "today" : task.next);
  const chips = [
    when,
    task.due ? chip(`deadline ${task.due}`, "bad") : "",
    task.priority && task.priority !== "medium" ? chip(task.priority, task.priority === "critical" || task.priority === "high" ? "bad" : "") : "",
    task.status === "blocked" ? chip("blocked", "bad") : "",
    task.project ? chip(task.project.replace(/^project-/, "")) : "",
    task.scope === "personal" ? chip("personal", "info") : "",
  ].join("");

  return row(
    `task:${task.id}`,
    `<div class="line">
       <span class="title">${esc(task.title)}</span>
       <span class="actions">
         <button data-done="${esc(task.id)}">Done</button>
         <button data-snooze="${esc(task.id)}" data-days="1">+1d</button>
         <button data-snooze="${esc(task.id)}" data-days="7">+1w</button>
       </span>
     </div>
     <div class="chips">${chips}</div>`,
    { selected, tone: late ? "late" : "" }
  );
}

/** Due and coming up. */
export function today(state, selected) {
  const { due, upcoming } = state.tasks;
  if (!due.length && !upcoming.length) return `<div class="empty">Nothing due, and nothing in the next fortnight.</div>`;
  return [
    due.length ? `<h2>Due (${due.length})</h2>${due.map((t) => taskRow(t, selected)).join("")}` : "",
    upcoming.length ? `<h2>Next 14 days (${upcoming.length})</h2>${upcoming.map((t) => taskRow(t, selected)).join("")}` : "",
  ].join("");
}

/**
 * Why a PR wants attention, split by whose move it is: the user's items
 * first and in full, everyone else's as one line each.
 */
function why(items) {
  const yours = items.filter((i) => i.who === "user");
  const others = items.filter((i) => i.who !== "user");
  const lines = [
    ...yours.slice(0, 2).map((i) => `<div class="you"><b>You</b> · ${esc(i.description)}</div>`),
    ...others.slice(0, Math.max(1, 3 - yours.length)).map((i) => `<div><b>${WHO_LABEL[i.who]}</b> · ${esc(i.description)}</div>`),
  ];
  const hidden = items.length - lines.length;
  if (hidden > 0) lines.push(`<div>+${hidden} more</div>`);
  return lines.length ? `<div class="why">${lines.join("")}</div>` : "";
}

/** A PR: what it is, where it stands, and why it wants anyone. */
function prRow(pr, selected) {
  return row(
    `pr:${pr.id}`,
    `<div class="line">
       <span class="title">${esc(pr.title)}</span>
       <span class="ref">#${esc(pr.number)}</span>
     </div>
     <div class="chips">${prChips(pr)}</div>
     ${why(pr.attention_items)}`,
    { selected, tone: pr.attention ? "attention" : "" }
  );
}

/** Pull requests: the ones needing the user, then the rest. */
export function prs(state, selected) {
  if (!state.prs.length) return `<div class="empty">No tracked pull requests.</div>`;
  const wants = state.prs.filter((p) => p.attention);
  const rest = state.prs.filter((p) => !p.attention);
  return [
    wants.length ? `<h2>Needs you (${wants.length})</h2>${wants.map((p) => prRow(p, selected)).join("")}` : "",
    rest.length ? `<h2>Waiting on others (${rest.length})</h2>${rest.map((p) => prRow(p, selected)).join("")}` : "",
  ].join("");
}

/** A project: where it stopped, and how long ago. */
function projectRow(p, selected) {
  const age = p.current_state_age;
  const chips = [
    age !== null ? chip(`state ${age}d old`, age > 30 ? "warn" : "") : chip("no saved state", "warn"),
    p.issues?.length ? chip(`${p.issues.length} issue${p.issues.length > 1 ? "s" : ""}`, "info") : "",
  ].join("");
  const first = String(p.current_state ?? "").split("\n").find((l) => l.trim()) ?? "";
  return row(
    `project:${p.id}`,
    `<div class="line"><span class="title">${esc(p.title)}</span></div>
     <div class="chips">${chips}</div>
     ${first ? `<div class="why"><div>${esc(first)}</div></div>` : ""}`,
    { selected }
  );
}

/** Active projects, then paused ones. */
export function projects(state, selected) {
  const active = state.projects.filter((p) => p.status === "active");
  const paused = state.projects.filter((p) => p.status === "paused");
  if (!active.length && !paused.length) return `<div class="empty">No active or paused projects.</div>`;
  return [
    active.length ? `<h2>Active (${active.length})</h2>${active.map((p) => projectRow(p, selected)).join("")}` : "",
    paused.length ? `<h2>Paused (${paused.length})</h2>${paused.map((p) => projectRow(p, selected)).join("")}` : "",
  ].join("");
}
