/**
 * The details panel for a session or a job.
 */

import { chip, esc, fields } from "/shell/format.js";

/** A session: what it is for and what it takes. */
function session(s) {
  return `
    <h3>${esc(s.id)}</h3>
    ${s.activity ? `<div class="prose">${esc(s.activity)}</div>` : ""}
    ${fields([
      ["Status", esc(s.status)],
      ["Purpose", esc(s.purpose)],
      ["Takes", s.capabilities.map((c) => chip(c)).join(" ") || "nothing routed"],
      ["Fallback", s.fallback ? "yes" : ""],
      ["Directory", esc(s.directory)],
      ["Repositories", s.repos.map(esc).join("<br>")],
      ["Joined", esc(s.joined_at)],
      ["Last seen", esc(s.last_seen)],
    ])}`;
}

/** A job: who posted it, who holds it, and what it needs. */
function job(j) {
  return `
    <h3>${esc(j.body)}</h3>
    ${fields([
      ["State", esc(j.state)],
      ["Posted by", esc(j.from)],
      ["For", esc(j.to)],
      ["Held by", esc(j.claimed_by)],
      ["Lease until", esc(j.lease_expires_at)],
      ["Needs", j.needs.map((c) => chip(c)).join(" ")],
      ["Repository", esc(j.repo)],
      ["Priority", esc(j.priority)],
      ["Attempts", esc(j.attempts)],
      ["Ref", esc(j.ref)],
      ["Expires", esc(j.expires_at)],
      ["Id", esc(j.id)],
    ])}`;
}

/** Finds the selected item in the snapshot, or null when it has gone. */
export function find(state, key) {
  const [kind, ...rest] = String(key).split(":");
  const id = rest.join(":");
  const pool = { session: state.sessions, job: state.jobs }[kind] ?? [];
  const item = pool.find((x) => x.id === id);
  return item ? { kind, item } : null;
}

/** The panel's heading and body for one item. */
export function render({ kind, item }) {
  return kind === "session" ? { label: "Session", html: session(item) } : { label: "Job", html: job(item) };
}
