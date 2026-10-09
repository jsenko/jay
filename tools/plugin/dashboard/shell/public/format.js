/**
 * Small pieces any dashboard's rows and details can use.
 *
 * Shared by every plugin's dashboard through a link.
 */

/** Escapes text before it goes anywhere near innerHTML. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** A coloured label. Tone is good, warn, bad, info, or none for neutral. */
export function chip(text, tone = "") {
  return `<span class="chip ${tone}">${esc(text)}</span>`;
}

/** A definition list of whichever fields are present. */
export function fields(pairs) {
  const rows = pairs.filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!rows.length) return "";
  return `<dl class="fields">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
}

/** A link that opens outside the dashboard. */
export function link(url, text = url) {
  return `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(text)}</a>`;
}
