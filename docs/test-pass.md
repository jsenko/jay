# Manual test pass

What the automated checks can't cover: the plugins working in a real
client, the way the READMEs and [GUIDE.md](../GUIDE.md) say they do.
Run it before a release that changes behaviour, once in Claude Code and
once in opencode.

Each item is something to do and what should happen. When reality
differs, either the instructions or the documentation is wrong: note
which beside the item, then fix it or file it. Items marked **(?)**
test a claim not yet confirmed.

Copy this file somewhere outside the repository and tick it there; the
copy in git stays unticked.

## Installation

Use a scratch configuration, so your own stays untouched:
`CLAUDE_CONFIG_DIR=$(mktemp -d) ./install.sh …`, and likewise
`OPENCODE_CONFIG_DIR`.

- [ ] `./install.sh fyi` on a clean configuration adds the marketplace,
      installs fyi, asks for the default scope, and offers to allow the
      tools; `settings.json.before-jay` holds the previous settings
- [ ] `./install.sh code` installs fyi and crew too
- [ ] `./install.sh all` installs all five; with pr, the allow rules for
      its GitHub writes are offered, none matching `gh pr review --approve`
- [ ] Re-running keeps every answer and changes nothing else
- [ ] After a restart, `/mcp` lists the plugins' servers, all connected
- [ ] `~/.jay/plugins/<plugin>` links to the installed version after the
      first session starts
- [ ] `--opencode`: one `jay-<plugin>.js` per plugin in
      `~/.config/opencode/plugins/`, commands as `/<plugin>-<name>`, and
      the servers connect
- [ ] `./install.sh --uninstall pr` removes pr, keeps `~/.jay/config.json`
      and fyi's items, and removes it from opencode too
- [ ] No server is configured outside the plugins (`claude mcp list`): an
      earlier setup leaves nothing behind

## First session

- [ ] `/crew:start` with no argument starts `general`, names the other
      roles in one line, and asks what you're working on
- [ ] `/crew:start nonsense` errors and lists the real roles
- [ ] The ready report shows directory, repository, crew id, and
      `Notifications: channel` or `poll`
- [ ] Launched with the channels flag, a session reports `channel`;
      without it, `poll`
- [ ] In `poll` mode a role with capabilities checks every ten minutes,
      and stays silent when there is nothing, in both clients. `general`
      sets up no check until it takes capabilities
- [ ] `/crew:stop` writes `current_state` when a project is in play,
      releases held jobs, and leaves; `crew_who` from another session no
      longer lists it
- [ ] With hooks disabled, `/crew:start` says `~/.jay/plugins/` is
      missing and stops

## Working on code

- [ ] `coder` in a directory with a linked project briefs from the
      handoff; without one, says so and asks
- [ ] `/code:implement <small fix>` picks no tracking, says so, and
      creates no project
- [ ] `/code:implement <feature>` creates a project linked to the
      directory, writes its design note into the project's `folder`, and
      links the folder as `.projects/<name>`
- [ ] `/code:implement #<issue>` reads the issue first
- [ ] A decision during the work becomes a decision note on the project
- [ ] Self-review findings cite rule IDs; a rule in
      `~/.jay/rules/code-preferences.md` replaces the shipped preferences
- [ ] In an Apicurio repository the A rules load; elsewhere they don't
- [ ] It builds after changes, asks before committing, and doesn't push
- [ ] Stop, then start `coder` again in the same directory: it resumes
      from `current_state`
- [ ] From another directory, "pick up the <name> project" loads the
      handoff
- [ ] A project with `issues`: a new `coder` session checks them before
      trusting `current_state`, and says when one has closed
- [ ] On an open PR, a review comment produces an assessment and a
      proposed reply rather than a silent change

## Reviewing pull requests

- [ ] The watcher, with the channels flag, gets `{"github":"hello"}` and
      receives events without polling; without it, polls
      `get_new_events` as well as crew
- [ ] In `crew_who`, the watcher's activity starts with the repositories
      it watches, and a reviewer elsewhere doesn't conclude from `repos`
      that its work won't arrive
- [ ] A session that never calls a github-events tool doesn't poll
      GitHub (`get_status` from it starts polling)
- [ ] Stop the watcher, get a PR assigned, restart it: the startup
      reconcile tracks it, posts its review job, and refreshes items that
      moved, without losing other sessions' attention items
- [ ] A new PR assigned to you becomes a `pr` item and a review job; one
      not assigned to you and matching no exception is ignored
- [ ] A reviewer claims the job, refuses on a dirty tree, runs preflight,
      updates the item, and returns to the default branch
- [ ] Preflight sets a missing milestone with one plain `gh api` call;
      refused, it adds an `assign` attention item for you instead
- [ ] Verified blocking findings on a simple PR are posted, with request
      changes. With a Direction section, an unverified finding, or a
      `complex` PR, they are drafted on the item instead, and nothing is
      posted
- [ ] An optional-only review is posted, ending with the here / issue /
      skip question, and no verdict
- [ ] In auto mode, with the allow rules, each post is a `gh` command of
      its own with `--body-file` and runs without a refusal
- [ ] The author answers "O1 here, O2 issue": `followups` recorded, an
      issue filed for O2 and linked on the PR, O1 checked on the next
      re-review
- [ ] A push to a reviewed PR produces a re-review job, preferring the
      same reviewer
- [ ] `/pr:queue` lists at most five, quick wins and oldest first, and
      says how many it left out; a `stale` item is refreshed first
- [ ] `/pr:checkout <n>` briefs in thirty seconds and doesn't review; on
      a drafted PR it shows the draft and posts it only with your
      verdict
- [ ] Finishing a manual review records `manual_review` and tells the
      watcher, which clears `attention`; reviewing on GitHub instead is
      picked up from the event. No session but the watcher writes
      `attention`
- [ ] "Review PR <n>" in a reviewer session shows findings before
      posting, and sets the session to `focus`
- [ ] Nothing approves, merges, or pushes to a contributor branch, at
      any point

## Tasks, notes and statuses

- [ ] "Remind me on Friday to …" creates a task due Friday, without
      asking which type
- [ ] "Remember that …" creates a note
- [ ] A "remind me" with no date is challenged or becomes a note, never
      a task with an invented date
- [ ] "…, personal" goes to the personal scope
- [ ] "What needs me today?" returns due, upcoming, blocked, PRs and
      projects in one answer
- [ ] A note with `archive_after_days: 1` is archived the day after its
      last change, and `fyi_get` still finds it
- [ ] `/status:brief` summarises what it found, asks once about what's
      missing, and gives a few bullets with no headings
- [ ] Something private or not yet public is asked about before it is
      included
- [ ] `/status:weekly` writes prose and saves a `report` note

## Dashboards

- [ ] `/fyi:dashboard` starts it and gives its URL; completing and
      snoozing a task show up in a session's next `fyi_today`
- [ ] The menu lists crew's views, and choosing one starts crew's
      dashboard
- [ ] The menu collapses and stays collapsed after a reload; clicking a
      row opens the panel; ✕ and Esc close it; the selection survives the
      30-second refresh
- [ ] A PR row is readable at a glance: complexity, review, your review,
      author response, CI, and "You ·" lines only for your moves
- [ ] A hand edit to a task file shows in the next tool call
- [ ] crew's Sessions view flags a stale session; Jobs flags one past its
      lease

## Several sessions

- [ ] "Ask a reviewer to look at PR <n>" confirms before posting
- [ ] Typing into an unattended reviewer sets it to `focus`; work posted
      meanwhile goes elsewhere or waits
- [ ] "Start taking review work too" changes capabilities without a
      restart
- [ ] Posting a job no session can take reports it at once
- [ ] A Claude Code watcher and an opencode reviewer see each other and
      pass a job
- [ ] `/crew:retry-smaller` (`/crew-retry-smaller` in opencode), after a
      blocked response, retries in smaller pieces

## Versions

- [ ] A `store.json` with a higher version makes writes fail, saying to
      update fyi; reads still work
- [ ] A crew `state.json` with a higher version is refused with the same
      advice

## Documentation

- [ ] Every link in the READMEs, GUIDE.md and `docs/` resolves
- [ ] Nothing is described in the present tense that isn't built
- [ ] GUIDE.md, followed from the top on a clean machine, works as
      written
