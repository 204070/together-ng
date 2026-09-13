# Decisions

Calls made while setting up the backlog and the agentic process for
Together. The technical implementation plan (`_docs/together-prd.md`,
Section 65) left some infrastructure questions open, and setting up
parallel agentic work raised the rest. They're settled here so issues and
future process changes stop re-litigating them.

## D1. Test runners: Bun's built-in runner for logic, Vitest for components

`apps/api` and both `packages/*` are tested with `bun test`. `apps/web` and
`apps/admin` are tested with Vitest + `@testing-library/react`.

Reason: Bun's runner is fast and needs no config for plain TypeScript, but
its jsdom/browser-emulation support isn't as mature as Vitest's yet, and
component tests are the only place that matters here. Running two runners is
worth it to avoid forcing React component tests through a runner that isn't
built for them. `bun run test` at the repo root fans out to both via
Turborepo, so nobody has to remember which package uses which.

## D2. Migrations live in one place: `packages/db`

All schema and migrations live in `packages/db`, managed by Drizzle Kit, as a
single migration history.

Consequence: **at most one issue per wave may add a migration.** Two issues
that both add migrations in the same wave will conflict at merge regardless
of which tables they touch, because they're editing the same folder of
sequentially generated files. See the wave rule in `_docs/PROCESS.md`.

## D3. Lint and format: Biome, one tool, one command

Biome checks both lint and format in one command: `bunx biome check .`.
`bunx biome check --write .` fixes what it can. One tool, one config,
nothing to keep in sync between a linter and a formatter.

## D4. Worktree database naming and lifecycle

Each worktree gets two databases: `together_wt<issue>` for development and
`together_wt<issue>_test` for tests. Both are created once, during worktree
setup, with the `vector` and `pg_trgm` extensions enabled (Section 65.4
depends on both).

Both databases are created once and reused for the life of the worktree, not
recreated per test run. Test isolation - truncating between tests, or
wrapping each test in a rolled-back transaction - is the test setup's job,
not the database's. This is why two suites racing in one worktree corrupt
each other (`_docs/PROCESS.md`): they race on truncation, not on database
creation, but the failure looks the same either way.

## D5. Worktree ports are derived from the issue number

`apps/api` binds to `4000 + <issue>`, `apps/web` to `5000 + <issue>`,
`apps/admin` to `5100 + <issue>`, written into that worktree's `.env` as
`PORT`, `WEB_PORT`, `ADMIN_PORT`.

Reason: QA verifies issues in parallel, in their own worktrees, as each
engineer finishes (`_docs/PROCESS.md`, Lifecycle). If every worktree's dev
server defaulted to the same port, the second one to start would either fail
to bind or silently talk to the first worktree's server. A port derived from
the issue number means two worktrees can run their dev servers at the same
time without anyone having to notice or negotiate.

## D6. `scripts/pin-env.ts` pins the database before anything else runs

A real environment variable beats a `.env` file, by design - that's what
lets containers and CI ship no `.env` at all. Left alone, that means an
exported `DATABASE_URL` in the shell that launched a session silently
shadows every worktree's own `.env` and puts all of them back on one
database.

`scripts/pin-env.ts` is the guard: a tracked script that loads the working
directory's `.env` file, if one exists, and force-applies its values over
the process's existing environment before running whatever command follows
it. If no `.env` file is present - which is how it tells a worktree from a
container - it does nothing and the ambient environment (Compose's, in CI)
is left alone.

Every `package.json` script that touches the database is defined in terms of
it (`"test": "bun run scripts/pin-env.ts bun test"`, and so on), so a
forgotten `DATABASE_URL=...` prefix on the command line costs nothing.

## D7. AI-assisted features wait for the deterministic loop

No issue may be groomed for embeddings, semantic matching, LLM-assisted
request guidance, or moderation-assist (Section 65.6) until the deterministic
ask → match → help → confirm loop (Section 62, sequenced in Section 67) is
merged and stable. A task that touches these before then gets pushed to a
`post-mvp` follow-up by the PM rather than groomed as-is.

## D8. Shared-file hotspots for integration

The files most likely to collide across parallel branches, and therefore the
ones the orchestrator reads each issue's Constraints section for before
placing it in a wave: `packages/schemas/src/index.ts`,
`packages/db/src/schema.ts` (and anything under `packages/db/migrations`, see
D2), `apps/web/src/router.tsx`, `apps/admin/src/router.tsx`, `.env.example`,
and `AGENTS.md`.

## D9. CI is a real, independent gate - not a restatement of QA

A GitHub Actions workflow runs `bun run test`, `bunx biome check .`, and the
migration-drift check (D2) on every push and every pull request. Branch
protection on `main` requires that workflow to pass before a merge is
possible, regardless of what any agent's report says.

Reason: every check in this process up to integration depends on an agent
truthfully running a command and truthfully reporting the result - the QA
verdict, the orchestrator's own rerun in `_docs/PROCESS.md`'s Integration
section, all of it. None of that is independently verifiable from outside
the conversation that produced it. CI is the one gate that runs the same way
regardless of what got said about it, so a hallucinated "tests pass" cannot
by itself get code onto `main`.

This does not replace the orchestrator's local rerun during integration -
that rerun catches problems before a push is even made, which is cheaper
than waiting for CI. CI is the backstop for when it doesn't.

**Sensitive-path review is two tiers, not one.** An issue whose Constraints
or actual diff touches private/contact fields anywhere in
`packages/schemas` or `packages/db/src/schema.ts`, or admin/moderation
actions (`apps/admin`, anything that should write to `audit_log`), gets a
checklist pass before merge: no private field added to a public response
shape, no admin or moderation action that skips `audit_log`. This is
mechanical enough that an agent runs it - QA or the orchestrator, reading
the diff against the checklist above - and it does not block on a person.

Auth/authz logic (`apps/api/src/auth`) and value-bearing logic (lending
thresholds, insurance - Section 29, 32) are a narrower, higher-stakes tier
and are reviewed by the project's architect personally, not an agent, before
that branch enters the merge queue. The reasoning: an agent reviewing
another agent's diff shares its blind spots - it's reliable at "does this
field appear somewhere it shouldn't," weak at "this is correct today but
wrong once resource categories multiply," which is exactly the judgment
this tier needs. This is not a new stall class - integration is already
serial and orchestrator-driven, and the architect's review happens at the
same point a destructive command would already stop and wait for someone,
not a separate gate the wave has to schedule around.

## D11. Wire schema conventions (all apps, packages/schemas)

One convention for every TypeBox wire schema, so Elysia routes, Eden Treaty
clients, and the DB agree without re-litigating per issue (settled while
grooming #3):

- Phone is E.164 (`+<cc><number>`, e.g. `+234...`) and optional at
  registration; validated when present
- Category and skill ids are integers (DB taxonomy identity); every other
  entity id is a UUID string
- Timestamps are ISO-8601 `date-time` strings on the wire
- Input (create/update/registration) schemas set `additionalProperties:
  false`; output/response schemas omit it (server controls responses and
  may add fields forward-compatibly)
- Length bounds that matter for UX (e.g. request text 1–2000) live on the
  wire and must be re-enforced server-side by the route that binds them;
  DB `text` columns stay unbounded

## D12. Private fields live on the entity that owns them in the DB

`email` and `phone` are user-level private fields because they are `users`
columns in #2, not `profiles` columns. A wire entity's public variant must
exclude every private field belonging to that entity **at the type level**
(§65.8), not by runtime filtering. A new private field (e.g. an exact
address) may not appear on the wire until a migration adds the column it
mirrors; introducing one the DB doesn't store is a hard FAIL.

## D13. SMS/phone provider adapter: Termii first, mockable

Phone messaging goes through one `OtpSender { sendOtp(phone, code) }` interface in `apps/api`, selected by `OTP_PROVIDER` (`mock` outside prod and always in tests, D10; `termii` in prod). Termii is the Nigeria-first MVP provider (§65.2); Africa's Talking stays plug-compatible behind the same interface. Binds future phone notifications (#13, #24) as well as auth OTP.

## D14. Token strategy: short access JWT (@elysiajs/jwt) + opaque rotating refresh

Custom auth, no better-auth: a 15-minute access JWT signed with the `@elysiajs/jwt` plugin (approved dependency) carrying `sub`/`sid`/`iat`/`exp` plus an opaque refresh token stored only as a SHA-256 hash in a `sessions` table, delivered as an `httpOnly`, `SameSite=Lax`, `Secure`-in-prod cookie scoped to `Path=/auth`, rotated on `/auth/refresh`. Reason: better-auth's table/field conventions conflict with the #3/D11/D12 wire shapes. Binds #7 (web auth state), #18 (admin auth), and the #25 auth follow-up.

## D15. Rate-limiting storage: in-memory for MVP

Fixed-window in-memory rate limiting behind `apps/api/src/lib/rate-limit.ts` (login 10/min/IP credential pair; OTP send 1/60s/phone; OTP verify 5/code leg; 429 always carries `Retry-After`). Multi-instance Redis backing is deferred: this binds #6, #11, #15, #19 at the point they become limits, not now.

## D16. Email normalization

Emails are stored lowercased and trimmed (normalization happens at registration and again at login lookup; email FORMAT is validated on the wire by #3, normalization is the API's job). Postgres unique indexes are the race-safe backstop (`23505` maps to `EMAIL_TAKEN`). Binds the email-OTP follow-up and notifications.

## D10. External providers are always mocked in tests

No test - `bun test` or `vitest`, local or in CI - makes a live call to the
Claude API, the SMS/WhatsApp aggregator, the email provider, or object
storage. Every one of these is mocked or stubbed at the boundary
(`packages/db`'s test setup and `apps/api`'s test fixtures own these mocks
so every app's suite gets them the same way).

Reason: these are exactly the features D7 defers until later, but the
decision is cheap to make now, before any test that could violate it exists.
A live LLM call in a test suite is nondeterministic, costs money on every
run including CI, and can leak a production-tier API key into a worktree's
`.env` (see the note on scoped keys in `_docs/PROCESS.md`). A test that
makes a real network call to any of these is a FAIL in QA, the same
severity as a hardcoded secret.