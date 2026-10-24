/**
 * What fyi's dashboard shows, for the shell's page: the list for each view, the
 * details panel, and the quick actions on a task.
 */

export { find, render as renderDetail } from "./details.js";
export * as rows from "./rows.js";

/** Done, +1d and +1w on a task row. */
export const actions = [
  { selector: "[data-done]", request: (el) => ["/api/complete", { id: el.dataset.done }] },
  { selector: "[data-snooze]", request: (el) => ["/api/snooze", { id: el.dataset.snooze, days: Number(el.dataset.days) }] },
];

/** Every scope, or one: the list's header offers the store's scopes. */
export const filter = {
  param: "scope",
  label: "Scope",
  fallback: "all",
  options: (state) => [{ value: "all", label: "All scopes" }, ...state.scopes.map((s) => ({ value: s, label: s }))],
};

/** Today's date, under the menu. */
export const footer = (state) => state.date;
