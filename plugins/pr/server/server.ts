/** The github-events MCP server: GitHub activity for watched repositories, pushed to sessions. */

import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Cache } from "./cache.js";
import { checkStatus } from "./check-status.js";
import { loadConfig, validateConfig } from "./config.js";
import { truncateEvent } from "./format.js";
import { API, fetchGitHubApi } from "./github.js";
import { greetOnce } from "./hello.js";
import { involvedPrs } from "./involved-prs.js";
import { Poller } from "./poller.js";
import { Backoff } from "./polling/backoff.js";

/** The plugin's version, so the server reports the release it ships in. */
const { version } = JSON.parse(readFileSync(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8"));

const cache = new Cache();

/** The watching session's polling interval; one server serves one session. */
const backoff = new Backoff();
const config = loadConfig();

try {
  validateConfig(config);
} catch (err: any) {
  console.error(`[github-events] ${err.message}`);
  process.exit(1);
}

const mcp = new Server(
  { name: "github-events", version },
  {
    capabilities: {
      tools: {},
      experimental: {
        "claude/channel": {},
      },
    },
    instructions: [
      "This server monitors GitHub repositories for PR and issue activity.",
      "It also monitors GitHub notifications for @mentions and replies across all repositories.",
      "Workflow run failures are tracked for watched repositories.",
      "It polls GitHub only once a session calls get_status or get_new_events; until then it makes no GitHub calls and pushes nothing, so only a session that watches pays for watching.",
      "Events are pushed as channel notifications with truncated bodies.",
      "After the first tool call it pushes {\"github\":\"hello\"} once: a session that receives it gets pushes and need not poll get_new_events.",
      "Use the get_event tool with the event_id from the notification meta to retrieve the full event (non-truncated body).",
      "Use the github_api tool to fetch any GitHub API URL — it uses a cache to avoid redundant requests.",
    ].join("\n"),
  }
);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_event",
      description: "Retrieve a cached GitHub event by its event ID. Returns the full event with non-truncated body and diff_hunk fields.",
      inputSchema: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "string",
            description: "The GitHub event ID (from the notification meta)",
          },
        },
        required: ["event_id"],
      },
    },
    {
      name: "get_new_events",
      description: "Returns GitHub events that have not been returned by a previous call to this tool, as `events`. Events are truncated (use get_event for full content). Each event includes an event_id and meta fields. `next_poll_minutes` says when to call again when polling on a timer: it grows while nothing arrives.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "github_api",
      description: "Fetch a GitHub API URL. Uses cached responses when available to reduce API calls. Returns the raw JSON response.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "The GitHub API URL to fetch (e.g. https://api.github.com/repos/owner/repo/pulls/42)",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "get_involved_prs",
      description: "Lists the open PRs in the watched repositories that the user authored, is assigned, or is asked to review, read live from each repository rather than from search, whose index can lag. `failed` names repositories that could not be read.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "get_check_status",
      description: "Derives a PR's check_status (passing, failing, pending, needs-approval) from its head: the latest run of each check, skipped runs ignored, and workflow runs held for approval, which the status rollup leaves out.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "The PR, e.g. https://github.com/owner/repo/pull/42" },
          gates: {
            type: "array",
            items: { type: "string" },
            description: "Check names that stay pending until run on demand; their failure reads as pending. A project rule names them.",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "get_status",
      description: "Returns the health status of the GitHub events server: authenticated user, monitored repos, last successful poll times per source (repo_events, pull_heads, workflow_runs, notifications), and any recent errors. Use this to diagnose whether empty results mean 'no events' or 'polling is broken'.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

/** Sends a channel notification to the session. */
function push(content: string): void {
  mcp.notification({ method: "notifications/claude/channel", params: { content } });
}

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  greetOnce(push);

  switch (req.params.name) {
    case "get_event": {
      const eventId = args.event_id as string;
      const event = cache.getEvent(eventId);
      if (!event) {
        return {
          content: [{ type: "text", text: `No cached event found for ID: ${eventId}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
      };
    }

    case "get_new_events": {
      await poller.ensureStarted();
      const newEvents = cache.consumeNewEvents();
      const result = {
        events: newEvents.map(({ id, event }) => ({
          event_id: id,
          event: truncateEvent(event),
        })),
        next_poll_minutes: backoff.next(newEvents.length > 0),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "github_api": {
      const url = args.url as string;
      if (!url.startsWith(`${API}/`)) {
        return {
          content: [{ type: "text", text: `URL must start with ${API}/` }],
          isError: true,
        };
      }
      const data = await fetchGitHubApi(url, config.githubToken, cache);
      if (data === null) {
        return {
          content: [{ type: "text", text: `Failed to fetch ${url}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    case "get_involved_prs": {
      await poller.ensureStarted();
      const { user, repos } = poller.watched();
      if (!user) {
        return { content: [{ type: "text", text: "The authenticated user is unknown, so nothing can be matched to them" }], isError: true };
      }
      const found = await involvedPrs(repos, user, config.githubToken);
      return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
    }

    case "get_check_status": {
      const match = String(args.url ?? "").match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      if (!match) {
        return { content: [{ type: "text", text: "url must be a pull request, e.g. https://github.com/owner/repo/pull/42" }], isError: true };
      }
      const gates = Array.isArray(args.gates) ? args.gates.map(String) : [];
      try {
        const report = await checkStatus(match[1], Number(match[2]), gates, config.githubToken);
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      } catch (err: any) {
        console.error(`[github-events] check status failed: ${err.stack ?? err}`);
        return { content: [{ type: "text", text: `Could not read the checks: ${err.message}` }], isError: true };
      }
    }

    case "get_status": {
      await poller.ensureStarted();
      const status = poller.getStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
  }
});

const poller = new Poller(config, cache, (eventId, event) => {
  push(JSON.stringify({ event_id: eventId, event: truncateEvent(event) }));
});

async function main(): Promise<void> {
  await mcp.connect(new StdioServerTransport());

  process.on("SIGINT", () => {
    poller.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    poller.stop();
    process.exit(0);
  });
  process.stdin.on("end", () => {
    poller.stop();
    process.exit(0);
  });
}

main();
