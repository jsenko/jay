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

/** Today's date, under the menu. */
export const footer = (state) => state.date;
