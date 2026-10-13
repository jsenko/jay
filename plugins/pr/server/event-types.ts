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

export interface Ref {
  html_url: string;
  api_url: string;
}

export interface NumberedRef extends Ref {
  number: number;
  title: string;
}

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

export interface PullRequestReviewEvent extends EventBase {
  type: "PullRequestReviewEvent";
  review_state: string;
  refs: {
    // title from follow-up API call; falls back to head branch name; html_url derived from api_url if unavailable
    pr: NumberedRef;
    review: Ref;
  };
}

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

export interface IssueCommentEvent extends EventBase {
  type: "IssueCommentEvent";
  // derived from presence of pull_request field on the issue
  is_pull_request: boolean;
  refs: {
    issue: NumberedRef;
    comment: Ref;
  };
}

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

export type Event =
  | PullRequestEvent
  | PullRequestReviewEvent
  | PullRequestReviewCommentEvent
  | IssuesEvent
  | IssueCommentEvent
  | WorkflowRunEvent
  | NotificationEvent;
