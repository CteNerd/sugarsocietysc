# Sugar Society SC — Project Guidelines

## Architecture
Monorepo (npm workspaces): `packages/web` (React/CRA frontend), `packages/api` (Node/TS Lambda
backend), `packages/infra` (AWS CDK), `packages/shared` (types + zod schemas used by both web and api).

Backend follows ports-and-adapters: business logic depends on interfaces in `packages/api/src/ports/*`
(e.g. `ISmsProvider`, `IPaymentProvider`, `IStorageProvider`), never directly on a vendor SDK. Concrete
vendors live in `packages/api/src/adapters/*` and are selected by a factory reading `AppConfig`
(`packages/api/src/config/env.ts`). Swapping a vendor (e.g. SNS -> Twilio) means adding one adapter class
and one factory case — never touching callers. Keep this pattern for any new external integration.

Lambda handlers are organized per-domain (health, auth-sync, newsletter, catalog, orders, admin,
webhooks-stripe), each a small `hono` app composed in `packages/api/src/app.ts` and wrapped by both a
Lambda adapter (`src/lambda.ts`) and a local dev server adapter (`src/local-server.ts`) — domain/service
code must stay framework-agnostic so both adapters work unmodified.

## Data access
No ORM. Use raw parameterized SQL via `pg` (`packages/api/src/db/pool.ts`), with hand-written repository
classes per aggregate. Schema migrations are plain `node-pg-migrate` files under `packages/api/migrations`.
Never string-concatenate SQL — always use parameterized queries.

## Build and Test
- `npm run dev` (root) — starts docker-compose backing services (Postgres/LocalStack/cognito-local), the
  API dev server, and the CRA dev server together. No AWS account needed for day-to-day work.
- `npm run build` / `npm test` (root) — runs across all workspaces.
- `npm run migrate --workspace=@sugarsocietysc/api` — run DB migrations.
- `npm run synth:dev --workspace=@sugarsocietysc/infra` — CDK synth only, never deploy without explicit
  user approval (deploys touch real AWS billing/resources).

## Conventions
- Validate every API boundary with a shared zod schema from `packages/shared/src/schemas`.
- Guest checkout orders require both `guestEmail` and `guestPhone`; their PII is purged by a scheduled
  job N days after order completion — never persist guest contact info beyond that window.
- Update README.md at the end of every phase/feature with current setup, architecture, and status.

## Model guidance (for AI-assisted work in this repo)
- Architecture/CDK design, auth/payments/IAM, multi-file refactors, planning: use the strongest available
  reasoning model.
- Repetitive boilerplate once a pattern already exists (CRUD repo methods, route wiring): a faster/cheaper
  model is fine.
- Security hardening passes: strongest reasoning model, explicitly checked against OWASP Top 10.
