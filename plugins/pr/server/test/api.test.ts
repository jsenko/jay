/** `github_api` serves a PR as it is now, and says how old what it serves is. */

import { join } from "node:path";

import { startFake } from "./fake-github.js";
import { check, connect, section, settle, tempDir } from "./harness.js";

/** Calls `github_api`, returning the body, the age line, and whether it was an error. */
async function fetchApi(client: any, url: string, fresh?: boolean) {
  const res: any = await client.callTool({ name: "github_api", arguments: fresh === undefined ? { url } : { url, fresh } });
  const [body, age] = res.content.map((c: any) => c.text);
  return { body: res.isError ? undefined : JSON.parse(body), age: age as string | undefined, error: res.isError === true };
}

/**
 * A session reads a PR through `github_api` before acting on it. A copy
 * cached when the PR opened sends it after labels the PR no longer has.
 */
export async function run(): Promise<void> {
  section("github_api");

  const github = await startFake("tester");
  github.pull("acme/widgets", { number: 9, title: "Cache keys", user: { login: "alice" }, labels: [{ name: "lifecycle/validation-failed" }] });
  const url = `${github.url}/repos/acme/widgets/pulls/9`;
  const reads = () => github.requests.filter((r) => r === "/repos/acme/widgets/pulls/9").length;

  process.env.GITHUB_API_MAX_AGE_SECONDS = "1";
  const conn = await connect(github.url, join(tempDir("api"), "state.json"));
  delete process.env.GITHUB_API_MAX_AGE_SECONDS;

  const first = await fetchApi(conn.client, url);
  check("the response says when it was fetched", /^fetched_at: \S+ \(\d+s ago\)$/.test(first.age ?? ""), first.age);
  await fetchApi(conn.client, url);
  check("within the maximum age, it is served from the cache", reads() === 1, reads());

  await fetchApi(conn.client, url, true);
  check("fresh:true checks with GitHub anyway", reads() === 2, reads());
  check("and an unchanged PR is confirmed with its ETag", github.pullNotModified === 1, github.pullNotModified);

  await settle(10);
  github.relabel("acme/widgets", 9, ["lifecycle/ready-for-review"]);
  await settle(1100);
  const later = await fetchApi(conn.client, url);
  check("past the maximum age, a changed PR is read afresh",
    later.body?.labels?.map((l: any) => l.name).join() === "lifecycle/ready-for-review", later.body?.labels);

  github.breakRepo("acme/widgets");
  const failed = await fetchApi(conn.client, url, true);
  check("a failure is an error", failed.error, failed);
  github.fixRepo("acme/widgets");
  await settle(1100);
  const recovered = await fetchApi(conn.client, url);
  check("and is not served from the cache past the maximum age", !recovered.error && recovered.body?.number === 9, recovered);

  await conn.client.close();
  await github.close();
}
