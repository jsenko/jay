/**
 * The dashboard page: the menu across every installed dashboard, the list, and the
 * details panel.
 *
 * The plugin's `/views.js` supplies what is shown:
 *   rows          { <view id>: (state, selected) => html } for the list
 *   find          (state, key) => found item or null, for the details panel
 *   renderDetail  (found) => { label, html }
 *   actions       optional [{ selector, request: (element) => [path, body] }]
 *   footer        optional (state) => text under the menu
 *
 * Refreshes every 30 seconds, keeping the view, the selection and an open panel.
 * Copied into every plugin with a dashboard from tools/plugin/dashboard/; edit it there.
 */

import * as views from "/views.js";
import { esc } from "/shell/format.js";

const REFRESH_MS = 30_000;

/** Reads a remembered preference, tolerating storage that is unavailable. */
function recall(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Remembers a preference, if the browser allows it. */
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A private window, say. The page works without it.
  }
}

let nav = null;
let state = null;
let view = null;
let selected = null;
let updatedAt = null;

const $ = (id) => document.getElementById(id);
const own = () => nav.dashboards.find((d) => d.plugin === nav.current);

/** The view to show: the one in the URL, else the remembered one, else the first. */
function initialView() {
  const ids = own().views.map((v) => v.id);
  const wanted = location.hash.slice(1) || recall("jay.view", ids[0]);
  return ids.includes(wanted) ? wanted : ids[0];
}

/** One menu item. Another dashboard's views say so, and open that dashboard. */
function navItem(dashboard, v) {
  const mine = dashboard.plugin === nav.current;
  const count = v.badge ? `<span class="count${v.badge.alert ? " alert" : ""}">${v.badge.n}</span>` : "";
  const target = mine ? `data-view="${esc(v.id)}"` : `data-remote="${esc(dashboard.plugin)}" data-remote-view="${esc(v.id)}" class="elsewhere"`;
  return `<button ${target} aria-current="${mine && v.id === view}" title="${esc(v.label)}"><span class="icon">${esc(v.icon)}</span><span class="text">${esc(v.label)}</span>${count}</button>`;
}

/** The menu: every installed dashboard's views, grouped by plugin when there are several. */
function renderNav() {
  const grouped = nav.dashboards.length > 1;
  $("views").innerHTML = nav.dashboards.map((d) =>
    (grouped ? `<div class="group">${esc(d.title)}</div>` : "") + d.views.map((v) => navItem(d, v)).join("")
  ).join("");
}

/** The details panel, closed when nothing is selected or the item has gone. */
function renderPanel() {
  const found = state && selected ? views.find(state, selected) : null;
  if (!found) selected = null;

  $("detail").hidden = !found;
  $("app").classList.toggle("with-detail", Boolean(found));
  if (!found) return;

  const { label, html } = views.renderDetail(found);
  $("detail-kind").textContent = label;
  $("detail-body").innerHTML = html;
}

/** Everything, from the current state. */
function render() {
  if (!nav || !state) return;
  document.title = own().title;
  $("brand").textContent = own().title;
  $("foot").textContent = views.footer?.(state) ?? "";
  $("heading").textContent = own().views.find((v) => v.id === view)?.label ?? "";
  $("updated").textContent = updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : "";
  renderNav();
  $("items").innerHTML = views.rows[view](state, selected);
  renderPanel();
}

/** Fetches a fresh state and menu. */
async function load() {
  try {
    [state, nav] = await Promise.all([(await fetch("/api/state")).json(), (await fetch("/nav")).json()]);
    view ??= initialView();
    updatedAt = new Date();
    render();
  } catch {
    $("items").innerHTML = `<div class="empty">Cannot reach the dashboard server.</div>`;
  }
}

/** Sends a JSON request to this dashboard's server. */
async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error);
  return result;
}

/** Opens another plugin's dashboard at a view, starting it first if it is not running. */
async function openElsewhere(button) {
  const { remote, remoteView } = button.dataset;
  const dashboard = nav.dashboards.find((d) => d.plugin === remote);
  button.setAttribute("aria-busy", "true");
  try {
    const { url } = dashboard.running ? dashboard : await post("/nav/start", { plugin: remote });
    location.href = `${url}/#${remoteView}`;
  } catch (err) {
    button.removeAttribute("aria-busy");
    $("items").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

/** Opens or closes an item's details. */
function select(key) {
  selected = selected === key ? null : key;
  render();
}

document.addEventListener("click", (e) => {
  for (const { selector, request } of views.actions ?? []) {
    const target = e.target.closest(selector);
    if (target) return void post(...request(target)).then(load);
  }

  const remote = e.target.closest("[data-remote]");
  if (remote) return void openElsewhere(remote);

  const local = e.target.closest("[data-view]");
  if (local) {
    view = local.dataset.view;
    remember("jay.view", view);
    history.replaceState(null, "", `#${view}`);
    selected = null;
    return void render();
  }

  if (e.target.closest("a")) return;
  const item = e.target.closest("[data-select]");
  if (item) return void select(item.dataset.select);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selected) {
    selected = null;
    render();
  }
  // Only the row itself: Enter on a button inside it presses the button.
  if (e.target.matches?.("[data-select]") && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    select(e.target.dataset.select);
  }
});

$("close").addEventListener("click", () => {
  selected = null;
  render();
});

$("refresh").addEventListener("click", load);

$("collapse").addEventListener("click", () => {
  const collapsed = !$("app").classList.contains("collapsed");
  $("app").classList.toggle("collapsed", collapsed);
  remember("jay.collapsed", String(collapsed));
});

$("app").classList.toggle("collapsed", recall("jay.collapsed", "false") === "true");

load();
setInterval(load, REFRESH_MS);
