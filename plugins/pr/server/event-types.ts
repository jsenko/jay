/** The events a session is told about, as the server formats them. */

/** Fields every event has. `body` is what a push truncates. */
interface EventBase {
  repo: string;
  // display_login preferred over login
  actor: string;
  // renamed from created_at
  timestamp: string;
  // "closed" becomes "merged" for merged PRs
  action: string;
  // newlines collapsed to spaces; truncated to 200 chars at output
  body: string;
}

/** Links to something on GitHub: the page, and the API URL for `github_api`. */
export interface Ref {
  html_url: string;
  api_url: string;
}

/** A link to a PR or issue, with its number and title. */
export interface NumberedRef extends Ref {
  number: number;
  title: string;
}

/** A PR opened, closed, merged, labelled… `labels-changed` collapses a run of label events. */
export interface PullRequestEvent extends EventBase {
  type: "PullRequestEvent";
  // from follow-up API call; falls back to head branch name
  title: string;
  // synthetic "merged" when action is "closed" and PR was merged; otherwise from follow-up API call
  state: string;
  // branch ref name extracted from nested base object
  base: string;
  // branch ref name extracted from nested head object
  head: string;
  // label names extracted from label objects
  labels: string[];
  draft: boolean;
  // from follow-up API call
  additions?: number;
  // from follow-up API call
  deletions?: number;
  // from follow-up API call
  changed_files?: number;
  refs: {
    // from follow-up API call; html_url and diff_url derived from api_url if unavailable
    pr: NumberedRef & { diff_url: string };
  };
}

/** A review submitted on a PR. */
export interface PullRequestReviewEvent extends EventBase {
  type: "PullRequestReviewEvent";
  review_state: string;
  refs: {
    // title from follow-up API call; falls back to head branch name; html_url derived from api_url if unavailable
    pr: NumberedRef;
    review: Ref;
  };
}

/** A comment on a PR's diff. */
export interface PullRequestReviewCommentEvent extends EventBase {
  type: "PullRequestReviewCommentEvent";
  path: string;
  position: number | null;
  // newlines collapsed to spaces; truncated to 200 chars at output
  diff_hunk: string;
  refs: {
    // title from follow-up API call; falls back to head branch name; html_url derived from api_url if unavailable
    pr: NumberedRef;
    comment: Ref;
  };
}

/** An issue opened, closed, labelled… */
export interface IssuesEvent extends EventBase {
  type: "IssuesEvent";
  title: string;
  state: string;
  // label names extracted from label objects
  labels: string[];
  // login names extracted from assignee objects
  assignees: string[];
  refs: {
    issue: NumberedRef;
  };
}

/** A comment on an issue or on a PR's conversation. */
export interface IssueCommentEvent extends EventBase {
  type: "IssueCommentEvent";
  // derived from presence of pull_request field on the issue
  is_pull_request: boolean;
  refs: {
    issue: NumberedRef;
    comment: Ref;
  };
}

/** A finished workflow run, or one waiting for a maintainer to approve it. */
export interface WorkflowRunEvent extends EventBase {
  type: "WorkflowRunEvent";
  workflow_name: string;
  conclusion: string;
  // "push", "pull_request", "schedule", "workflow_dispatch", etc.
  trigger_event: string;
  head_branch: string;
  run_number: number;
  run_attempt: number;
  refs: {
    run: Ref;
    pr?: NumberedRef;
  };
}

/** A GitHub notification from outside the watched repositories. */
export interface NotificationEvent extends EventBase {
  type: "NotificationEvent";
  // "mention", "comment", "review_requested", etc.
  notification_reason: string;
  subject_type: string;
  subject_title: string;
  is_pull_request: boolean;
  refs: {
    subject: Ref;
    comment?: Ref;
  };
}

/** Any event a session can be told about. */
export type Event =
  | PullRequestEvent
  | PullRequestReviewEvent
  | PullRequestReviewCommentEvent
  | IssuesEvent
  | IssueCommentEvent
  | WorkflowRunEvent
  | NotificationEvent;
