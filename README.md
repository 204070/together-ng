# Together.ng

A community-powered platform where people post what they need help with and others offer assistance — borrowing tools, sharing skills, mentoring, or collaborating on local projects. Think of it as a mutual-aid network with structured request/response workflows, two-sided outcome confirmation, and reputation tracking.

## How it works

1. **Post a request** — describe what you need, the barrier you're facing, and what kind of help would move you forward
2. **Offer help** — anyone can submit an offer ("I can help") on an open request, partial or full
3. **Accept & contribute** — the requester reviews offers, accepts one or more, and the contribution begins
4. **Confirm & rate** — both sides confirm completion, the recipient answers "Did this help you move forward?"
5. **Build reputation** — confirmed helpful contributions update your profile (people helped, successful contributions)

## Monorepo layout

```
apps/
  web/     # TanStack Start — public + authenticated user app
  admin/   # React + Vite — internal admin SPA
  api/     # Bun + Elysia — HTTP, WebSocket, and worker entrypoints
packages/
  schemas/ # Shared TypeBox schemas — single source of truth for API shapes
  db/      # Drizzle schema + migrations, query helpers
  config/  # Shared tsconfig config
```

## Prerequisites

- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- [Docker](https://docs.docker.com/get-started/install/) — for Postgres and Redis

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Start Postgres and Redis
docker compose up -d

# 3. Set up the database
bun run --filter @together/db db:migrate
bun run --filter @together/db db:seed

# 4. Start the dev servers
bun run dev
```

The API runs on **http://localhost:4000** and the web app on **http://localhost:5000**.

## Commands

Run from the root:

| Command | What it does |
|---------|--------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start dev servers for all apps |
| `bun run build` | Build all apps |
| `bun run test` | Run the full test suite |
| `bun run lint` | Lint and format-check with biome |
| `bun run typecheck` | Typecheck every workspace |
| `bun run format` | Format the whole repo with biome |
| `bun run check` | Lint + format + apply safe fixes |

## Testing

```bash
# Run all tests
bun run test

# Run tests for a specific package
bun run --filter @together/db test
bun run --filter @together/api test
```

Tests use Bun's built-in test runner with transaction rollback isolation against a real Postgres instance.

## Tech stack

- **Runtime:** Bun
- **API:** Elysia (HTTP + WebSocket)
- **Web:** TanStack Start (React SSR)
- **Database:** Postgres + pgvector
- **ORM:** Drizzle
- **Cache/Queue:** Redis + pg-boss
- **Validation:** TypeBox
- **Linting:** Biome
