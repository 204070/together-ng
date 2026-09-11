# Together.ng

The together.ng project

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

## Commands

Run from the root:

- `bun install` — install all workspace dependencies
- `bun run dev` — run the dev process for each app
- `bun run build` — build all apps
- `bun run lint` — lint and format-check every file with biome
- `bun run typecheck` — typecheck every workspace
- `bun run format` — format the whole repo with biome
- `bun run check` — lint + format + apply safe fixes with biome
