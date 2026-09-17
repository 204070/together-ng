- Tasks are GitHub issues
- Commit regularly

Labels

- `mvp` - needed for the MVP defined in `_docs/together-prd.md` (Sections
  60-61)
- `post-mvp` - real work, deliberately not now
- Every issue carries exactly one of the two, new ones included

Background

- `_docs/decisions.md` - the calls already made, with reasons. Read it before
  grooming or implementing, and do not reopen a decision without changing it
  there first
- `_docs/together-prd.md` and `_docs/together-wireframes.html` hold the
  product spec, the technical implementation plan, and the wireframes. They
  are reference, not the backlog - where they disagree with
  `decisions.md` or an issue, they lose

Roles

- PM - grooms a task before anyone implements it, follows `_docs/team/pm.md`
- Engineer - implements one groomed task, follows
  `_docs/team/software-engineer.md`
- QA - checks the result against the acceptance criteria, follows
  `_docs/team/qa-engineer.md`


Orchestrator

The main session is the orchestrator. It launches the PM, the engineer
and QA as subagents. It does not groom, implement or test itself.

The orchestrator owns three things the subagents cannot see: the
dependency order of the backlog, the worktrees, and the merge queue.


Changing the backlog

New work, or a change to an issue that's already groomed or has an
engineer working against it, goes through the orchestrator rather than a
direct edit:

- A new idea - say so to the orchestrator. It either grooms it directly
  if trivial or files it ungroomed for the next PM pass. One source of
  truth for what's in the backlog beats issues appearing that the
  orchestrator doesn't know to sequence
- An ungroomed issue nobody has started - editing it directly is fine,
  nothing is implemented against the old version yet
- A groomed issue, or one with an engineer already on it - comment on
  the issue, the same channel QA and the architect's review use. An
  engineer implements against what's written and has no way to notice a
  silent edit partway through (`_docs/team/software-engineer.md`); a
  comment gives the orchestrator a clear point to decide whether it's a
  re-groom, a note for QA to check, or something for the next wave,
  rather than the acceptance criteria moving under whoever's already
  building them


Working in parallel

Work runs in waves. A wave is a set of issues that can be built at the
same time without waiting on each other.

- Up to 5 agents run at once
- Every issue in a wave gets its own git worktree and its own branch
- Nothing is implemented in the main checkout. Main is for grooming,
  integration and the docs

An issue may enter a wave only when all of these hold:

- Every issue it depends on is closed and merged into main
- No other issue in the same wave adds a migration. All schema lives in
  one `packages/db` migration history, so two issues that both add
  migrations in the same wave conflict at merge no matter which tables
  they touch (`_docs/decisions.md`, D2)
- The orchestrator has read its Constraints section and knows which
  shared files it will touch (`_docs/decisions.md`, D8)

Everything else waits for the next wave. A wave is often smaller than 5
because the backlog runs out of independent work, not because the limit
was reached - that is normal, do not pad a wave to fill it.


Worktrees

One issue, one worktree, one branch:

    git worktree add ../wt/<issue> -b issue-<issue> main

Each worktree is a full checkout and needs its own setup before an agent
touches it:

- `bun install` - the worktree gets its own `node_modules`
- `.env` copied from the main checkout, with `DATABASE_URL` pointed at a
  database of its own, `together_wt<issue>`, and `TEST_DATABASE_URL`
  pointed at `together_wt<issue>_test`
- `CREATE DATABASE together_wt<issue>` and
  `CREATE DATABASE together_wt<issue>_test` inside the Postgres container,
  then `CREATE EXTENSION IF NOT EXISTS vector;` and
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;` on both - the schema depends
  on them and migrations fail without them. If a name is already taken,
  pick a fresh one rather than dropping it
- Ports written into that worktree's `.env`: `PORT` for `apps/api` at
  `4000 + <issue>`, `WEB_PORT` for `apps/web` at `5000 + <issue>`,
  `ADMIN_PORT` for `apps/admin` at `5100 + <issue>` (`_docs/decisions.md`,
  D5) - so a dev server left running in one worktree never collides with
  another

`.env` carries real provider keys (Claude, the SMS aggregator, object
storage) alongside `DATABASE_URL`. Copying it into up to five worktrees
at once means those keys now live in five places instead of one - use
scoped or dev-tier keys for worktree `.env` files, never production
credentials, and see D17 for why none of them should be called for real
during a test run anyway.

The database part is not optional. `.env` is git-ignored and
`packages/db/src/client.ts` reads it, so each worktree gets its own
development and test databases. Two worktrees sharing one `DATABASE_URL`
will run migrations or truncate tables underneath each other, and the
failures look like impossible bugs in the code rather than what they are.

There is a catch worth knowing about. A real environment variable beats
a `.env` file, by design - that is what lets containers and CI ship no
`.env` at all. So if the terminal that launched the session exports
`DATABASE_URL`, as this one does, it silently shadows every worktree's
`.env` and puts all of them back on one database.

Two things guard against that:

- Commands are run with the database named explicitly:
  `DATABASE_URL=postgres://postgres:postgres@localhost:5432/together_wt<issue> bun run test`
- Each worktree's scripts run through `scripts/pin-env.ts`
  (`_docs/decisions.md`, D6), wired into `package.json` as the first word
  of every script that touches the database - `"test": "bun run
  scripts/pin-env.ts bun test"` and so on. It loads that worktree's `.env`
  and force-sets `DATABASE_URL` and the port vars before the real command
  runs, so a forgotten prefix costs nothing. It stands down when no `.env`
  file is present, which is how it tells a local worktree from a
  container - Compose sets `DATABASE_URL` on purpose there and ships no
  `.env` at all

The setup is not complete until
`bun run scripts/pin-env.ts bun -e "console.log(process.env.DATABASE_URL)"`
prints the worktree's own database URL. Check it before an agent starts,
not after it reports a mysterious failure.

One suite at a time inside a worktree. The test database is created once
per worktree, not recreated per run, so two `bun test` (or `vitest`) runs
started together in the same worktree truncate and repopulate one
`together_wt<issue>_test` database underneath each other. It produces a
scatter of failures and errors that look like a real regression and are
not - two engineers have now lost time to it. A run that fails strangely
gets repeated alone before it is believed.

Waiting for the suite is part of the job. Wait inside a command - run it
in the foreground, or poll in a loop that ends. Nothing wakes an agent
that has stopped, so "I will report when it finishes" is where the work
ends: the run completes and nobody reads it. Two agents have finished
that way.

The same goes for anything else slow - a container coming back, a CI
run, a build. Poll it with a ceiling, and if it never arrives say so.
"Did not recover within two minutes" is a finding, and often a FAIL.
Silence is not.

Never kill test processes by name to clean up (`pkill -f "bun test"`,
`pkill -f vitest`). Every worktree on this machine runs its own suite
against its own database, so that pattern reaches into another agent's
run and kills it mid-test - the victim then reports an aborted suite
that looks like a broken branch and is not. Kill a background job by the
id the tool gave you, or let it finish. If you did not start it, do not
kill it.

One agent per worktree at a time. The database is isolated per worktree,
not per agent, so an engineer still finishing in a worktree and a
reviewer starting in the same one share one `together_wt<issue>_test`
database and will corrupt it under each other. An implementer commits,
pushes and is done before a reviewer is pointed at that worktree; the
orchestrator does not overlap them.

This binds the orchestrator too. A suite that is killed for running
long does not necessarily stop - the `bun test` or `vitest` child can
outlive the command that launched it, still holding its database
connections. Starting a second run then is the same self-collision, and
it produces a screen of errors that looks like the branch is broken when
it is not. The orchestrator lost time to exactly this. Before starting a
run in a worktree, confirm nothing is already alive in it (`pgrep -af
"bun test"`, `pgrep -af vitest`); a strange mass failure is repeated once,
alone and clean, before it is believed - the same rule the engineers get,
applied to integration.

Postgres itself stays a single container. Databases inside it are cheap;
a second container is not.

A merged worktree is left where it is. Reuse it for the next issue that
lands in the same area, or leave it alone. A stale checkout and an idle
database cost nothing next to a stalled run - see below for why nobody
deletes them mid-session.


Destructive commands stall the run

The harness checks commands that destroy things and asks the person
running the session to approve them. That is the right behaviour, but it
means the work stops dead until someone is at the keyboard. A wave of
five agents can sit idle overnight on one `rm`.

So nothing in this process deletes. Not worktrees, not branches, not
databases, not temporary files.

- Restore a file you changed on purpose with `git checkout -- <path>` or
  `git restore <path>`, never by copying it aside and deleting the copy
- Beware the version of that command with a commit in it.
  `git checkout <commit> -- <path>` *stages* what it writes, so the later
  `git checkout -- <path>` meant to undo it finds nothing to do and
  silently leaves the old file in place. Someone proved a fix worked by
  checking out the pre-fix file, and nearly shipped the branch with it.
  After restoring anything, `git status` and `git diff HEAD` both have to
  be empty before the work is called done
- Write temporary files to the session scratchpad, which is outside the
  repository and needs no cleanup, never to `/tmp` and never next to the
  code
- Leave worktrees, branches and `together_wt<issue>` (and `_test`)
  databases in place when an issue closes. They are a few megabytes and a
  row in `pg_database`
- Recreate a database with `CREATE DATABASE` on a fresh name rather than
  dropping and remaking the old one

If something genuinely has to be removed, that is the user's call. Say
what should go and why, and let them run it. Do not put a deletion in
front of an agent and hope it goes through.


Integration

A GitHub Actions workflow runs the same three checks - suite, linter,
migration-drift - on every push and every pull request, and branch
protection on `main` requires it green before a merge is even possible.
Everything below is the orchestrator's own rerun of those same checks
during integration, which catches a problem before a push is made rather
than waiting for CI to say so - it does not replace CI, and a green
report from an agent is never the thing that puts code on `main`; the
workflow run is.

Branches merge one at a time, never in parallel, in dependency order:

1. Rebase the branch on current main
2. Run the whole suite, the linter, and the migration check again, in
   the worktree, after the rebase: `bun run test`, `bun run lint`,
   and `bun run db:generate` followed by `git status packages/db/migrations`
   to confirm nothing new and uncommitted came out of it
3. If the branch touches auth or value-bearing logic (`_docs/decisions.md`,
   D9), the orchestrator opens a pull request from that branch against
   main - the only point in this process a PR exists at all - and links
   it on the issue. Then it says so in this conversation and moves on to
   other independent work in the wave rather than sitting idle - a
   tier-2 branch waiting on review is a normal backlog state, the same
   as one waiting on a dependency, not a stall
4. Merge to main only once a verdict is in, in the fixed shape below.
   Everything else skips straight to step 5, and no PR is opened for it
5. Push main
6. Close the issue
7. Rebase every still-open branch in the wave onto the new main, and run
   the same checks in each one immediately - not deferred to that
   branch's own turn in the queue

**How the architect's verdict reaches the orchestrator.** Two shapes,
matching how the review actually happens:

- *Same session* - the architect reviews (on GitHub, or in the worktree
  directly) and says the verdict in this conversation: "PR #47, approved"
  or "PR #47, needs changes: ...". The orchestrator records it as a PR/issue
  comment in the format below and proceeds - it does not need to go check
  GitHub itself, since it was just told
- *Separate session* - the architect takes their time and leaves the
  verdict as a comment on the PR itself, in the format below, whenever
  they get to it. The next time the orchestrator is running and would
  otherwise act on that branch, it checks the PR for a comment in that
  format before doing anything else with it. If there isn't one yet, that
  branch is still waiting - the orchestrator reports it as such and works
  on other things, rather than polling in a loop for a wait with no
  known ceiling; a ten-minute test run is worth polling for, an
  open-ended human review is not

Either way the comment is the same shape QA already uses, so both are
unambiguous to read later:

```
## Architect: FAIL

The lending-value threshold check compares against the resource's listed
value, not its assessed value - a requester who under-lists a resource's
worth bypasses the higher-value approval step entirely.
```

A FAIL here is handled exactly like a QA FAIL: back to that issue's
engineer alone, with the comment as input, and the rest of the wave
carries on. It is not a live thread - the engineer addresses the written
comment, pushes an update, and the updated branch goes back through the
same checks and the same review gate, since it's still tier-2. Anything
the architect wants to think out loud about while reviewing - inline
comments, questions - is fine to leave on the PR along the way; it's the
final `## Architect: PASS` or `## Architect: FAIL` comment that the
orchestrator actually acts on.

One agent per worktree at a time now includes the architect: the
engineer is done and has pushed before the architect, or QA, starts
there.

Step 7 is what keeps the wave honest, and the rerun inside it is not
optional. The second branch to merge is being tested against code its
author never saw; if the merge broke an assumption it made, that has to
surface right after the rebase, not sit undiscovered until that branch
finally comes up for its own integration - by then several more merges
may have built on top of the same broken assumption. A branch that fails
its post-rebase rerun gets the same treatment as a rebase that breaks
the branch, below: back to that branch's engineer, as a FAIL, before the
wave continues.

Step 5 is not bookkeeping. A local commit is invisible: the person whose
project this is opens GitHub, sees nothing, and has no way to tell a
working session from a stalled one. Push main as soon as it moves.

Engineers push their own branch too, as soon as it has a commit on it,
and again after each round of QA fixes. A branch nobody can see is a
branch nobody can review, and the whole wave's work is otherwise
invisible until it merges.

Once the orchestrator rebases a branch, that branch's history no longer
matches the one on origin, and every later push from it is a force push
- which stops and waits for a human. So after a rebase the engineer
stops pushing and says so; the orchestrator merges and pushes main, and
main carries the work. Nobody force-pushes to repair the branch. The
stale copy on origin is superseded the moment main moves, and a stale
branch costs nothing while a blocked push costs the whole run.

Conflicts concentrate in a few shared files - `packages/schemas/src/index.ts`,
`packages/db/src/schema.ts`, `apps/web/src/router.tsx`,
`apps/admin/src/router.tsx`, `AGENTS.md`, `.env.example`
(`_docs/decisions.md`, D8). The orchestrator resolves them at
integration. An engineer who finds a conflict is looking at a stale
branch and should rebase, not merge main into their branch.

A rebase that breaks the branch goes back to that branch's engineer with
the failure, as a FAIL. The orchestrator does not fix it.


Lifecycle

1. Pick the next wave: open issues whose dependencies are all merged
2. PM grooms each ungroomed issue in the wave
3. Set up a worktree per issue, then launch one engineer per issue, in
   parallel
4. QA verifies each one in its own worktree, in parallel, as its
   engineer finishes - QA does not wait for the whole wave
5. On FAIL, back to step 3 for that issue alone, with the QA comment as
   input. The rest of the wave carries on
6. On PASS, integrate that branch through the merge queue and close the
   issue
7. Leave the worktree and its databases in place
8. Repeat until the backlog is empty

Rules

- One issue per worktree, one engineer per issue
- Do not skip step 2, even when the task looks obvious
- The engineer does not close the issue, QA does not fix the code
- Do not commit until the tests pass
- An agent stays inside its own worktree. Reading main is fine, writing
  to it or to another worktree is not
- Only the orchestrator merges, closes issues, and deletes worktrees
- QA must verify before merge. If the engineer makes additional commits
  after QA's initial pass, QA must re-verify those changes before merge.
  The orchestrator must not merge without a QA PASS on the final state

Process Violations

- 2026-09-17: Issue #10 merged without QA on final commits. Engineer made
  3 additional commits after initial QA PASS (sort default fix, timestamp
  collision fix, test robustness fix). Orchestrator merged without
  re-running QA. Retroactive QA confirmed PASS.