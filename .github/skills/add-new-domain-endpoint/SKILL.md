---
name: add-new-domain-endpoint
description: 'Scaffold a new Lambda backend domain endpoint in packages/api: service, hono routes, zod schema, and mounting in app.ts. Use when adding a new API resource/endpoint to the backend.'
---

# Add a New Domain Endpoint

## When to Use
Adding a new resource to the API (e.g. `newsletter`, `catalog`, `orders`) that needs its own service,
routes, and request validation.

## Procedure
1. Add a request/response zod schema to `packages/shared/src/schemas/<domain>-schemas.ts` and export it
   from `packages/shared/src/index.ts`.
2. Create `packages/api/src/domains/<domain>/<domain>-repository.ts` — raw parameterized SQL via the pool
   from `src/db/pool.ts`. No ORM.
3. Create `packages/api/src/domains/<domain>/<domain>-service.ts` — business logic, depends on the
   repository and any ports it needs (`ISmsProvider`, `IPaymentProvider`, etc.), never on vendor SDKs.
4. Create `packages/api/src/domains/<domain>/<domain>-routes.ts` — a `Hono` sub-app, validates input with
   the zod schema from step 1, calls the service, returns JSON. Mirror the structure in
   `packages/api/src/domains/health/health-routes.ts`.
5. Mount the new routes in `packages/api/src/app.ts`: `app.route('/<domain>', <domain>Routes(pool))`.
6. If the endpoint needs auth, add the Cognito JWT authorizer requirement at the API Gateway route level
   in `packages/infra/lib/api-stack.ts` (not in application code).
7. Add a unit test for the service with a fake repository/port implementations (no real DB/network calls).
