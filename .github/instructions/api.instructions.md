---
description: "Use when writing or modifying Lambda backend code under packages/api: handlers, services, repositories, ports/adapters, or DB migrations."
applyTo: "packages/api/**"
---
# API (Lambda Backend) Conventions

- Layering: `handler`/route (hono) -> `service` (business logic) -> `repository` (raw SQL via `pg`).
  Services must never import `pg` directly or construct SQL — only repositories do.
- New external integrations (payment, notification, storage, or anything else) always get: an interface in
  `src/ports/<domain>/`, a concrete adapter in `src/adapters/<domain>/`, and a factory function that reads
  `AppConfig` to pick the implementation. Never call a vendor SDK directly from a service.
- Every new domain gets its own folder under `src/domains/<domain>/` with its own service + routes, mounted
  in `src/app.ts` — keep domains independent of each other.
- Validate all inbound request bodies with a zod schema imported from `@sugarsocietysc/shared`.
- DB schema changes are new files in `migrations/` (node-pg-migrate), never hand-edited against a live DB.
- Local dev: `npm run dev --workspace=@sugarsocietysc/api` (tsx watch + local Node server adapter), backed
  by `docker compose up` for Postgres/LocalStack/cognito-local.
