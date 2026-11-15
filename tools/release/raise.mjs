/**
 * Raises one dependency range in a plugin manifest to a version's
 * ^major.minor, for release.sh: a release that starts relying on a new
 * minor of another plugin says so in the same commit, which tools/check
 * can't let a commit do before that minor exists.
 *
 *   node raise.mjs <plugin.json> <dependency> <version>
 *
 * Only the range's text is replaced, so the manifest keeps its layout.
 * A compound range (^1.2 || ^2) is left to a person, since which side to
 * raise depends on why it is compound.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [file, dependency, version] = process.argv.slice(2);

/** Stops with a message for release.sh to show. */
function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const manifest = JSON.parse(text);
const dep = (manifest.dependencies ?? []).find((d) => d.name === dependency);
if (!dep) fail(`${manifest.name} has no dependency on ${dependency}`);
if (dep.version.includes("||")) fail(`${manifest.name}: raise its compound range ${dep.version} on ${dependency} by hand`);

const [major, minor] = version.split(".");
const range = `^${major}.${minor}`;
const pattern = new RegExp(`("name":\\s*"${dependency}",\\s*"version":\\s*")[^"]+"`);
if (!pattern.test(text)) fail(`can't find the range on ${dependency} in ${file}`);
writeFileSync(file, text.replace(pattern, `$1${range}"`));
console.log(`${manifest.name} now needs ${dependency} ${range}`);
