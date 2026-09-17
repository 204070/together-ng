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

Biome checks both lint and format in one command: `bun run lint` (`biome check .`).
`bun run check` (`biome check --write .`) fixes what it can. One tool, one config,
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

A GitHub Actions workflow runs `bun run test`, `bun run lint`, and the
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

Phone messaging goes through one `OtpSender { sendOtp(phone, code) }` interface in `apps/api`, selected by `OTP_PROVIDER` (`mock` outside prod and always in tests, D17; `termii` in prod). Termii is the Nigeria-first MVP provider (§65.2); Africa's Talking stays plug-compatible behind the same interface. Binds future phone notifications (#13, #24) as well as auth OTP.

## D14. Token strategy: short access JWT (@elysiajs/jwt) + opaque rotating refresh

Custom auth, no better-auth: a 15-minute access JWT signed with the `@elysiajs/jwt` plugin (approved dependency) carrying `sub`/`sid`/`iat`/`exp` plus an opaque refresh token stored only as a SHA-256 hash in a `sessions` table, delivered as an `httpOnly`, `SameSite=Lax`, `Secure`-in-prod cookie scoped to `Path=/auth`, rotated on `/auth/refresh`. Reason: better-auth's table/field conventions conflict with the #3/D11/D12 wire shapes. Binds #7 (web auth state), #18 (admin auth), and the #25 auth follow-up.

## D15. Rate-limiting storage: in-memory for MVP

Fixed-window in-memory rate limiting behind `apps/api/src/lib/rate-limit.ts` (login 10/min/IP credential pair; OTP send 1/60s/phone; OTP verify 5/code leg; 429 always carries `Retry-After`). Multi-instance Redis backing is deferred: this binds #6, #11, #15, #19 at the point they become limits, not now.

## D16. Email normalization

Emails are stored lowercased and trimmed (normalization happens at registration and again at login lookup; email FORMAT is validated on the wire by #3, normalization is the API's job). Postgres unique indexes are the race-safe backstop (`23505` maps to `EMAIL_TAKEN`). Binds the email-OTP follow-up and notifications.

## D17. External providers are always mocked in tests

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

## D18. Migrations are named explicitly, never left auto-generated

Every migration is generated with an explicit name - bun run db:generate --name add_request_matches_table, not a bare bun run db:generate left to produce something like 0007_absurd_black_widow.sql.

Reason: D2 already means every migration in the project lands in one shared, sequential history, written by whichever issue happens to touch schema next. In that history, a filename is the only thing that tells someone what a given step did without opening it - 0007_absurd_black_widow means nothing on a rebase, in a conflict, or six months later when something needs a down migration written by hand; 0007_add_request_matches_table means something at a glance. Pick a name that describes the schema change itself (add_lending_value_threshold_column, drop_unused_badge_icon_column), not the issue title verbatim - issue titles describe a feature, not necessarily what the migration does.

## D19. Background worker architecture: BullMQ over pg-boss, isolated runner process

Background jobs (request matching and notification dispatch) migrate from pg-boss (Postgres-backed) to BullMQ (Redis-backed). Workers run in an isolated entrypoint (`apps/api/src/worker/runner.ts`) separate from the Elysia HTTP server process.

Reason: pg-boss stores all jobs, state transitions, and locks inside Postgres (`pgboss.job`), and each queue instance polls Postgres constantly. Because the database pool is capped (10 connections), concurrent matching transactions and notification queries choke the database and starve HTTP handlers under traffic surges. BullMQ moves all queue state, polling, and locks to Redis (already present in Compose), operating with sub-millisecond in-memory latencies and consuming zero Postgres connections. Decoupling the worker process prevents heavy candidate scoring from starving the API event loop. Binds #48.

## D20. Redis and S3 driver strategy: Native Bun primitives behind decoupled service interfaces

Production Redis and S3 implementations utilize native Bun primitives (`Bun.redis` and `Bun.s3`) behind decoupled service interfaces (`RedisService` and `FileStorage`), backed by in-memory mock implementations for testing.

Reason: Bun provides native Zig/C++ implementations for Redis and S3 that outperform third-party Node packages and hand-rolled TCP socket parsers while adding zero npm dependencies. Wrapping them in clean interfaces preserves decoupling, avoids vendor lock-in, and enforces D17 (external providers remain strictly mockable in test suites). Binds #49 and #50.

## D21. Real-time WebSockets: Native Elysia/Bun topics with Redis Pub/Sub multi-instance scaling

WebSocket topic subscriptions use native Elysia/Bun topic primitives (`ws.subscribe`), backed by Redis Pub/Sub (`vote_updates` channel) for multi-instance broadcast.

Reason: In-process `Map` state (`voteSubscribers`) cannot scale horizontally across multiple API containers behind a load balancer. Native uWebSockets topics eliminate manual subscriber set management and connection leak risks at the C++ layer, while Redis Pub/Sub fans out updates across all API instances without introducing heavy message brokers (Kafka/RabbitMQ). Binds #51.

## D22. Ephemeral OTP security: HMAC-SHA256 over Argon2id

Short-lived 6-digit OTP codes (5-minute TTL, 3-attempt limit) are hashed using HMAC-SHA256 and verified using constant-time comparison (`timingSafeEqual`). Passwords strictly continue to use Argon2id via `Bun.password.hash`.

Reason: Argon2id is intentionally CPU- and memory-expensive to resist offline brute-force attacks against long-term passwords. Applying Argon2id to ephemeral 6-digit numeric codes burns 50–200ms of CPU per verification, causing CPU starvation during signup/login surges. HMAC-SHA256 with a server secret completes in microseconds, protecting the database against read-compromise while maintaining high throughput. Binds #52.

## D23. Exclusive Drizzle Query Builder: Zero raw SQL, schema-first compile-time type safety

All database queries across stores, services, routes, and workers must strictly use the Drizzle ORM query builder (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`) and typed operators (`eq`, `and`, `or`, `inArray`, `notInArray`, `desc`, `asc`, etc.) re-exported from `@together/db`. Raw SQL tagged templates (`sql\`...\``) and raw query strings are strictly forbidden for application logic and queries.

Reason: Raw SQL creates schema drift where database schema updates fail silently at compile time and only explode at runtime. It forces brittle, repetitive manual column mapping (`snake_case` to `camelCase`), breaks query composition, and introduces subtle bugs from JavaScript operator confusion (e.g. using `&&` instead of Drizzle's `and()`, which drops query predicates silently). Drizzle query builder enforces schema-first type safety, automatically maps column names, and validates query structures at build time. Specialized raw SQL fragments are permitted only inside Drizzle's `sql` helper for PostgreSQL-specific constructs (e.g., `tsvector`, full-text search rankings, vector distance calculations) where no builder method exists. Settled in #39.

## D24. Unified database connection pool: Single client lifecycle, zero redundant pools

The application, background workers, and service factories share a single Drizzle database instance (`Db`) backed by `node-postgres` (`pg.Pool`), initialized via `packages/db/src/client.ts`. Service factories accept `{ db: Db }` as a dependency. The legacy `Sql` client (`postgres.js` tagged template client), `createClient()`, and `env.sql` plumbing are deprecated and removed.

Reason: Creating separate connection pools for raw `sql` and Drizzle `db` doubled connection consumption, quickly exhausting PostgreSQL connection pool limits (capped at 10 connections) and leaving idle connection pools sitting in production memory. In addition, service factories and individual test suites must never manage or terminate the shared pool lifecycle. Connection pool shutdown (`getPool().end()`) is owned exclusively by the process entrypoint (`apps/api/src/index.ts`, worker runners, or the global test harness). Binds #40.

## D25. API architecture: Centralized authentication boundary, decoupled authorization, and uniform HTTP errors

Protected API routes authenticate strictly through the centralized perimeter guard `createAuthGuard` or helper `requireActiveActor` / `requireActiveUser` (`apps/api/src/lib/authentication.ts`). Route handlers receive the verified `actor` (`userId`, `sessionId`) from context and perform domain authorization (resource ownership, permissions, and role checks); handlers must never parse JWTs, re-verify tokens, or execute redundant database queries to confirm active account status.

All domain modules (`apps/api/src/modules/<domain>/`) follow a three-tier separation:
1. `routes.ts`: HTTP transport layer only. Binds Elysia route endpoints, enforces TypeBox wire validation schemas, checks actor authorization, and delegates to services.
2. `services.ts`: Business logic and orchestration, decoupled from HTTP frameworks.
3. `store.ts`: Database query persistence layer using Drizzle query builder.

All HTTP and application errors must throw `HttpError` (`apps/api/src/lib/errors.ts`) or its standard factory helpers (`unauthorizedError`, `forbiddenError`, `notFoundError`, `conflictError`, `badRequestError`). Elysia's root `onError` handles mapping `HttpError` into standard JSON payloads (`{ error: { code, message, details } }`). Ad-hoc error classes, custom JSON error shapes, and manual status code setting for errors are prohibited. Binds #31.

## D26. Test isolation: Transaction rollback pattern over table truncation

Test suites use transaction rollback isolation via global `tests/setup.ts`: in `beforeEach`, a connection is acquired from `getPool()`, begins a transaction (`BEGIN`), binds a transaction-scoped Drizzle instance (`setDatabase(txDb)`), and in `afterEach` executes `ROLLBACK` and releases the connection. Tests do not recreate databases or run migrations per test file; schema migrations execute once globally in `tests/setup.ts`.

Consequences:
- **No per-file pool teardown:** Test files must never call `getPool().end()` in `afterAll`. Global pool lifecycle is owned by `tests/setup.ts`.
- **Postgres 25P02 prevention (aborted transaction blocks):** In PostgreSQL, when a statement fails with a constraint violation (e.g. `23505 unique_violation`), the entire transaction is marked aborted (`25P02: current transaction is aborted, commands ignored until end of transaction block`). To prevent normal validation tests (such as duplicate email/phone registration) from aborting the test transaction, application code must perform pre-flight existence checks (`findByEmail`, `findByPhone`) before `insert()`. For tests explicitly asserting raw database constraint errors, wrap the query in an explicit `SAVEPOINT` / `ROLLBACK TO SAVEPOINT` block.
- **Worker test isolation (`__SKIP_TX_ISOLATION__`):** Background workers run on independent database connections outside the test runner's transaction and cannot see uncommitted data from `BEGIN ... ROLLBACK`. Worker test suites must opt out of transaction rollback isolation by setting `(globalThis as any).__SKIP_TX_ISOLATION__ = true` at the file top and use deterministic table truncation (`TRUNCATE`) in `beforeEach`. Binds #42.

## D27. Fast test fixtures: Lightweight token synthesis over crypto hashing, centralized factories

Test suites must never invoke Argon2id password hashing or call HTTP login endpoints to obtain authentication tokens. Tests must generate test JWTs using `createToken()` from `apps/api/src/testing/helpers.ts`, which synthesizes valid HS256 tokens in <1ms via HMAC-SHA256 Web Crypto. Fixed mock hashes (`DEFAULT_PASSWORD_HASH`) must be used for password database seeds.

All entity generation in tests must use centralized test helper factories (`createUser`, `createCategory`, `createSkill`, `addCapability`, `setPrefs` in `apps/api/src/testing/helpers.ts`) rather than duplicated raw inserts or ad-hoc test seeds. Binds #42.

## D28. Feed and query optimization: Denormalized vote counts, composite indexes, and Redis feed caching

To eliminate dynamic aggregation bottlenecks and full table scans on high-traffic read paths:
1. **Denormalized request vote counts:** The `requests` table stores a denormalized `vote_count` column (`integer('vote_count').notNull().default(0)`). Voting mutations (`addVote` and `removeVote`) atomically update `requests.vote_count` using SQL expressions within the same database transaction as the vote record creation or deletion (`onConflictDoNothing()`). Feed and search queries read `requests.vote_count` directly, avoiding costly dynamic `COUNT(*)` subqueries or joins on `votes`.
2. **Targeted composite indexes:**
   - `requests(state, created_at DESC)` optimizes state-filtered feed pagination without in-memory sort passes.
   - `notifications(user_id, type, created_at)` accelerates worker dispatch queries and notification queries without multi-index scans.
3. **Featured feed caching:** The `/requests/featured` feed endpoint caches responses in Redis with a short TTL (30 seconds) via `RedisService` (`MockRedisService` in test environments per D17). Cache keys incorporate sorting, pagination parameters, and all applied filters (`feed:featured:...`). Cache misses populate the cache transparently, and Redis errors degrade gracefully to direct database queries. Binds #53.