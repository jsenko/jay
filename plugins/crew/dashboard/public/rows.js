/**
 * The middle column: one compact row per session or job, showing what decides
 * whether to open it.
 */

import { chip, esc } from "/shell/format.js";

/** A clickable row. `key` is `<kind>:<id>`, which the details panel opens. */
function row(key, inner, { selected, tone = "" }) {
  return `<div class="row ${tone}${selected === key ? " selected" : ""}" role="button" tabindex="0" data-select="${esc(key)}">${inner}</div>`;
}

const STATUS_TONE = { stale: "warn", focus: "info" };

/** Who is on the board, what each is doing, and what it takes. */
export function sessions(state, selected) {
  if (!state.sessions.length) return `<div class="empty">No sessions on the board.</div>`;
  return state.sessions
    .map((s) =>
      row(
        `session:${s.id}`,
        `<div class="line"><span class="title">${esc(s.id)}</span></div>
         <div class="chips">${chip(s.status, STATUS_TONE[s.status] ?? "")}${s.capabilities.map((c) => chip(c)).join("")}${s.fallback ? chip("fallback", "info") : ""}</div>
         ${s.activity ? `<div class="why"><div>${esc(s.activity)}</div></div>` : ""}`,
        { selected, tone: s.status === "stale" ? "late" : "" }
      )
    )
    .join("");
}

/** Why a job is flagged, in the words a row has room for. */
function trouble(j) {
  if (j.state === "stuck" || j.state === "expired") return chip(j.state, "bad");
  if (j.unroutable) return chip("no session can take it", "bad");
  if (j.slow) return chip("lease ran out", "warn");
  return chip(j.state);
}

/** Jobs that need someone to act first, then the rest. */
export function jobs(state, selected) {
  if (!state.jobs.length) return `<div class="empty">No work outstanding.</div>`;
  const render = (j) =>
    row(
      `job:${j.id}`,
      `<div class="line"><span class="title">${esc(j.body)}</span></div>
       <div class="chips">${trouble(j)}${j.claimed_by ? chip(`held by ${j.claimed_by}`) : ""}${j.needs.map((c) => chip(c)).join("")}</div>`,
      { selected, tone: j.flagged ? "attention" : "" }
    );
  const flagged = state.jobs.filter((j) => j.flagged);
  const rest = state.jobs.filter((j) => !j.flagged);
  return [
    flagged.length ? `<h2>Needs someone (${flagged.length})</h2>${flagged.map(render).join("")}` : "",
    rest.length ? `<h2>In hand (${rest.length})</h2>${rest.map(render).join("")}` : "",
  ].join("");
}
