# Sugar Society SC

Full-stack platform for Sugar Society SC (royal icing cookie bakery): public site, user accounts,
newsletter, pre-sale and custom cookie order workflows, Stripe payments, and an admin dashboard.

## Architecture

Monorepo (npm workspaces):

```
packages/
  web/      React (CRA) frontend
  api/      Node/TypeScript Lambda backend (hono), raw SQL via pg (no ORM)
  infra/    AWS CDK (TypeScript) — Network/Data/Auth/Api/Web stacks
  shared/   Shared TS types + zod schemas used by both web and api
```

The backend uses a ports-and-adapters design for every external integration (SMS, email, payments,
storage) so vendors can be swapped (e.g. SNS -> Twilio) by adding one adapter class, never by touching
business logic. See [.github/copilot-instructions.md](.github/copilot-instructions.md) for full
conventions, and `.github/instructions/*.instructions.md` for per-package rules.

Auth is Amazon Cognito (with OAuth/social login support), the database is Aurora Serverless v2
(PostgreSQL), and hosting is S3 + CloudFront (replacing the previous GitHub Pages deployment once the
cutover is complete).

## Local Development

Requires Docker and Node 20+.

```bash
cp .env.local.example .env.local   # edit if needed, defaults match docker-compose.yml
npm install
npm run dev
```

This single command starts:
- Postgres, LocalStack (S3/SNS/SQS/Secrets Manager), and cognito-local via `docker compose up`
- The API dev server (`packages/api`, hot reload) on `http://localhost:3001`
- The CRA frontend dev server (`packages/web`) on `http://localhost:3000`

No AWS account is required for day-to-day feature work.

### One-time local auth setup
cognito-local needs a fixed User Pool + client (real Cognito gets these from the CDK `AuthStack` instead):
```bash
npm run seed:cognito --workspace=@sugarsocietysc/api   # run once cognito-local is up
```
Copy the printed `COGNITO_*` / `REACT_APP_COGNITO_*` values into `.env.local`. Note: cognito-local always
issues tokens with host `0.0.0.0` (not `localhost`) in the `iss` claim — `COGNITO_ISSUER_URL` must use
`0.0.0.0` locally, exactly as the script prints it.

### Other useful commands
```bash
npm run build                                          # build all workspaces
npm test                                                # test all workspaces
npm run migrate --workspace=@sugarsocietysc/api         # run DB migrations
npm run synth:dev --workspace=@sugarsocietysc/infra     # CDK synth (template generation, no AWS calls)
npm run diff:dev --workspace=@sugarsocietysc/infra      # CDK diff against the dev environment
```

`cdk deploy` is intentionally not run automatically by AI agents in this repo — deploys touch real AWS
billing/resources and require explicit human approval.

## Deployment

- **Frontend**: currently deployed to GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  on push to `main`. Will migrate to S3 + CloudFront (`packages/infra` `WebStack`) as part of the AWS
  cutover.
- **Backend/Infra**: not yet deployed to AWS. `packages/infra` defines `dev` and `prod` environments (see
  `packages/infra/cdk.json`); CI (`.github/workflows/infra-ci.yml`) runs `cdk synth` on PRs touching infra
  code.

## Project Status

Phase 0 (monorepo foundation) complete:
- [x] Monorepo restructure (`packages/web|api|shared|infra`)
- [x] Ports-and-adapters scaffolding (notification/payment/storage) with a working `/health` vertical slice
- [x] CDK stack skeletons (Network, Data, Auth, Api, Web) — not yet deployed
- [x] Local dev stack (`docker-compose.yml`, `npm run dev`)
- [x] Repo-level AI tooling (`.github/copilot-instructions.md`, scoped instructions, custom agents, skills)
- [ ] GitHub OIDC role + AWS account setup, first real `cdk deploy`

Phase 1 (auth & accounts) — local-only scope in progress, AWS checkpoint deferred:
- [x] `users` + `holiday_preferences` migration
- [x] `auth-sync` domain (`POST /auth-sync`, `GET /auth-sync/me`) with Cognito JWT verification
  (`packages/api/src/auth`), backed by `jose` against cognito-local/Cognito JWKS
- [x] `packages/api/scripts/seed-cognito-local.ts` — one-time local User Pool/client bootstrap
- [x] CDK: `ApiStack` wired to `AuthStack`'s User Pool via an `HttpJwtAuthorizer` (defense-in-depth at the
  API Gateway edge; synth-only so far, not deployed)
- [x] Web: `amazon-cognito-identity-js` signup/confirm/login/account pages + `AuthProvider`/`ProtectedRoute`
- [ ] Google OAuth federation — requires a real deployed `AuthStack` + registered Google OAuth client
  (deferred to the Phase 1 AWS checkpoint, see `/memories/repo/local-dev-vs-aws-strategy.md` conceptually)
- [ ] Newsletter, catalog, order workflows, payments, admin dashboard — see upcoming phases

