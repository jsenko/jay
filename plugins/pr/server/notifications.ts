/** Polling GitHub notifications, for activity outside the watched repositories. */

import type { PollContext } from "./context.js";
import type { NotificationEvent, Ref } from "./event-types.js";
import { collapseWhitespace } from "./format.js";
import { API, fetchGitHubApi, githubHeaders, htmlUrlFromApiUrl } from "./github.js";

/**
 * GitHub notifications the user takes part in, from repositories outside
 * the watched ones: mentions and replies elsewhere. Watched repositories
 * already arrive as events, and the user's own activity is skipped.
 */
export async function pollNotifications(ctx: PollContext): Promise<void> {
  if (!ctx.user) return;

  try {
    const since = ctx.state.lastNotificationAt;
    let url = `${API}/notifications?participating=true&per_page=50`;
    if (since) {
      url += `&since=${since}`;
    }

    const res = await fetch(url, { headers: githubHeaders(ctx.config.githubToken) });

    if (res.status === 403 || res.status === 429) {
      ctx.health.error("notifications", "Rate limited polling notifications");
      return;
    }
    if (!res.ok) {
      const msg = `Notifications poll failed: ${res.status}`;
      console.error(`[github-events] ${msg}`);
      ctx.health.error("notifications", msg);
      return;
    }

    const notifications: any[] = await res.json();
    if (notifications.length === 0) {
      if (!ctx.state.lastNotificationAt) {
        ctx.state.lastNotificationAt = new Date().toISOString();
      }
      ctx.health.success("notifications");
      return;
    }

    const watchedRepoSet = new Set(ctx.repos);
    const isFirstRun = !ctx.state.lastNotificationAt;
    const seenAtCursor = new Set(ctx.state.notificationsAtCursor ?? []);

    let latestUpdatedAt = since ?? "";

    for (const notif of notifications) {
      if (notif.updated_at > latestUpdatedAt) {
        latestUpdatedAt = notif.updated_at;
      }

      if (isFirstRun) continue;

      // Delivered by the previous poll: `since` includes its own instant.
      if (notif.updated_at === since && seenAtCursor.has(notif.id)) continue;

      if (notif.reason === "author" || notif.reason === "state_change") continue;

      const repoFullName = notif.repository?.full_name;
      if (repoFullName && watchedRepoSet.has(repoFullName)) continue;

      const formatted = await formatNotification(ctx, notif);
      if (!formatted) continue;

      const eventId = `notif-${notif.id}`;
      ctx.cache.setEvent(eventId, formatted);
      ctx.onEvent(eventId, formatted);
    }

    ctx.state.lastNotificationAt = latestUpdatedAt || new Date().toISOString();
    ctx.state.notificationsAtCursor = notifications
      .filter((n) => n.updated_at === ctx.state.lastNotificationAt)
      .map((n) => n.id);
    ctx.health.success("notifications");
  } catch (err) {
    const msg = `Error polling notifications: ${err}`;
    console.error(`[github-events] ${msg}`);
    ctx.health.error("notifications", msg);
  }
}

/** A notification as a session sees it, with its latest comment; null for the user's own. */
async function formatNotification(ctx: PollContext, notif: any): Promise<NotificationEvent | null> {
  const subject = notif.subject;
  if (!subject) return null;

  if (subject.type !== "Issue" && subject.type !== "PullRequest") return null;

  let body = "";
  let actor = "unknown";
  let commentRef: Ref | undefined;

  if (subject.latest_comment_url) {
    const commentData = await fetchGitHubApi(
      subject.latest_comment_url, ctx.config.githubToken, ctx.cache
    );
    if (commentData) {
      body = collapseWhitespace(commentData.body);
      actor = commentData.user?.login ?? "unknown";
      commentRef = {
        html_url: commentData.html_url ?? "",
        api_url: subject.latest_comment_url,
      };
    }
  }

  if (actor === ctx.user) return null;

  const subjectApiUrl: string = subject.url ?? "";
  const isPR = subject.type === "PullRequest";

  return {
    type: "NotificationEvent",
    repo: notif.repository?.full_name ?? "unknown",
    actor,
    timestamp: notif.updated_at,
    action: notif.reason,
    notification_reason: notif.reason,
    subject_type: subject.type,
    subject_title: subject.title,
    is_pull_request: isPR,
    body,
    refs: {
      subject: {
        html_url: htmlUrlFromApiUrl(subjectApiUrl),
        api_url: subjectApiUrl,
      },
      ...(commentRef ? { comment: commentRef } : {}),
    },
  };
}
