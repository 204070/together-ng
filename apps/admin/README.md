# Together Admin SPA (`@together/admin`)

Internal administrative single-page application built with React + Vite and calling `@together/api` via Eden Treaty.

## Architecture

- **Framework**: React 19 + Vite (no SSR).
- **API Client**: Eden Treaty (`@elysiajs/eden`) typed by Elysia `App` from `@together/api`.
- **Wire Schemas**: Shared TypeBox contracts imported from `@together/schemas` (`AdminMe`, `AdminReports`).
- **Auth Flow**: D14 rotating session architecture. Admin users sign in via `POST /auth/login` to obtain a 15-minute access JWT and an `httpOnly`, `SameSite=Lax`, `Secure` refresh cookie scoped to `/auth`. The SPA proactively rotates sessions every 12 minutes and automatically refreshes on 401s via `POST /auth/refresh`.

## Deployment Gating & Network Isolation

Per **PRD §65.2 (Table 1)** and **Decision D9**:
The Admin SPA and its corresponding API endpoints (`/admin/*`) are internal tools and must never be exposed publicly without network-level isolation or identity gating.

### 1. Reverse Proxy / Gateway Configuration
In staging and production, the admin SPA and `/admin/*` routes must be restricted by one of the following mechanisms:

- **Corporate SSO / Identity-Aware Proxy (Recommended)**:
  Gate the admin domain (e.g. `admin.together.ng`) behind Cloudflare Access, Google Cloud IAP, or Tailscale. Only corporate identity holders can reach the login interface.
- **IP Allowlisting**:
  Configure the reverse proxy (Nginx, Caddy, Cloudflare WAF, or Traefik) to restrict requests to known corporate/office CIDR blocks.
  Alternatively, the API server can check `ADMIN_ALLOWED_IPS` environment variable containing a comma-separated list of allowed client IP addresses.

### 2. Role-Based Access Control (RBAC)
In addition to network-level gating, all `/admin/*` endpoints strictly require `users.is_admin = true`:
- Unauthenticated requests receive `401 Unauthorized`.
- Valid non-admin user tokens receive `403 Forbidden` (`ADMIN_ACCESS_REQUIRED`).
- Admin actions are logged to `audit_log` per PRD §50.

## Development

```bash
# Start development server on port 5118 (or assigned ADMIN_PORT)
bun run dev

# Run unit and component tests
bun run test

# Type check TypeScript files
bun run typecheck

# Build production bundle
bun run build
```
