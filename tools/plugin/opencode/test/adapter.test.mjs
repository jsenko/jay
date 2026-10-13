// The adapter run over every real plugin: what opencode is told, and what lands on disk.
// HOME points at a scratch directory, so the links and skill copies never touch the real one.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, readlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { register } from "../adapter.mjs";
import { opencodeName, toOpencodeRefs } from "../names.mjs";

const PLUGINS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "plugins");
const HOME = mkdtempSync(join(tmpdir(), "jay-opencode-"));
process.env.HOME = HOME;
delete process.env.FYI_DIR;

/** Every plugin registered into one config, as opencode would load them all. */
async function registerAll(config = {}) {
  for (const plugin of readdirSync(PLUGINS)) await register(join(PLUGINS, plugin), config);
  return config;
}

test("names are prefixed with their plugin, once", () => {
  assert.equal(opencodeName("crew", "start"), "crew-start");
  assert.equal(opencodeName("fyi", "fyi-triggers"), "fyi-triggers");
  assert.equal(toOpencodeRefs("run /crew:start, then /code:implement"), "run /crew-start, then /code-implement");
  assert.equal(toOpencodeRefs("see https://github.com/a/b and ~/.jay/plugins/crew/rules/crew.md"),
    "see https://github.com/a/b and ~/.jay/plugins/crew/rules/crew.md");
});

test("every command is registered under its opencode name, ready to run", async () => {
  const config = await registerAll();
  for (const plugin of readdirSync(PLUGINS)) {
    let files = [];
    try { files = readdirSync(join(PLUGINS, plugin, "commands")); } catch {}
    for (const file of files) {
      const name = opencodeName(plugin, file.replace(/\.md$/, ""));
      assert.ok(config.command[name], `${name} is registered`);
    }
  }
  for (const [name, { template }] of Object.entries(config.command)) {
    assert.ok(!template.includes("${CLAUDE_PLUGIN_ROOT}"), `${name}: root substituted`);
    assert.ok(!/(^|[\s(`])\/(fyi|crew|status|code|pr):[a-z]/m.test(template), `${name}: no Claude Code command references left`);
  }
  assert.ok(config.command["crew-start"].description, "descriptions come from front matter");
});

test("servers keep their names, so opencode's tool names stay the same", async () => {
  const config = await registerAll();
  assert.deepEqual(Object.keys(config.mcp).sort(), ["crew", "fyi", "github-events"]);
  for (const [name, spec] of Object.entries(config.mcp)) {
    assert.equal(spec.type, "local");
    assert.ok(spec.command.every((part) => !part.includes("${")), `${name}: command substituted`);
  }
  assert.ok(config.mcp["github-events"].command[1].startsWith(join(PLUGINS, "pr")));
});

test("skills are renamed copies, and an unchanged skill isn't rewritten", async () => {
  const config = await registerAll();
  const code = join(HOME, ".local", "share", "jay", "code", "opencode-skills");
  assert.ok(config.skills.paths.includes(code));
  const copy = readFileSync(join(code, "code-style", "SKILL.md"), "utf8");
  assert.match(copy, /^name: code-style$/m);
  assert.ok(!copy.includes("/code:"), "references rewritten");
  assert.ok(readdirSync(join(HOME, ".local", "share", "jay", "fyi", "opencode-skills")).includes("fyi-triggers"),
    "a skill already named after its plugin keeps its name");

  const before = statSync(join(code, "code-style", "SKILL.md")).mtimeMs;
  await registerAll();
  assert.equal(statSync(join(code, "code-style", "SKILL.md")).mtimeMs, before);
});

test("~/.jay is reachable, the user's rules stay, and the grants come last", async () => {
  // The user's own rule for ~/.jay comes before their catch-all, which would win if the grant stayed there.
  const config = await registerAll({ permission: { external_directory: { [join(HOME, ".jay", "**")]: "deny", "*": "ask" } } });
  const rules = Object.entries(config.permission.external_directory);
  const all = rules.findIndex(([path]) => path === "*");
  const jay = rules.findIndex(([path]) => path === join(HOME, ".jay", "**"));
  assert.equal(rules[all][1], "ask", "the user's rule is kept");
  assert.equal(rules[jay][1], "allow");
  assert.ok(jay > all, "the grant comes after the user's rules, even one for the same path");
  assert.ok(rules.some(([path, v]) => path === join(HOME, ".fyi", "*", "projects", "**") && v === "allow"),
    "fyi's project folders are writable");
});

test("each plugin is linked at ~/.jay/plugins/<name>", async () => {
  await registerAll();
  for (const plugin of readdirSync(PLUGINS)) {
    assert.equal(readlinkSync(join(HOME, ".jay", "plugins", plugin)), join(PLUGINS, plugin));
  }
});
