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
conventions, `.github/instructions/*.instructions.md` for per-package rules, and
[docs/ROADMAP.md](docs/ROADMAP.md) for the full scope, decisions, data model, and phase-by-phase status.

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

### Stripe test-mode setup (required for Phase 6 deposit payments)

1. In the [Stripe Dashboard](https://dashboard.stripe.com), stay in **Test mode** and copy your test
   **publishable** (`pk_test_...`) and **secret** (`sk_test_...`) keys from Developers → API keys.
2. For local dev, run the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks and get a
   local signing secret: `stripe listen --forward-to localhost:3001/webhooks/stripe`.
3. Set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in `packages/api/.env.local` and
   `REACT_APP_STRIPE_PUBLISHABLE_KEY` in `packages/web/.env.local`.
4. For a deployed environment, populate the Secrets Manager secret `sugarsocietysc/<env>/stripe` (created
   out-of-band, never by CDK) with `{ "secretKey": "sk_test_...", "webhookSecret": "whsec_..." }`, and add
   a Stripe webhook endpoint pointing at `https://<api-domain>/webhooks/stripe` for the
   `payment_intent.succeeded` event.

## Project Status

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full phase-by-phase plan and status. Summary:
- [x] Phase 0 — Foundation (monorepo, CDK stack skeletons, local dev stack, repo AI tooling) — not yet deployed to AWS
- [x] Phase 1 — Auth & Accounts, local-only (Cognito-compatible signup/login/JWT, account pages) — Google
  OAuth + first real AWS deploy intentionally deferred to a dedicated checkpoint
- [ ] Phase 2 — Newsletter signup (subscribe/unsubscribe/preferences) — mostly done; admin copy review and
  real SES/SNS send verification deferred to the AWS checkpoint
- [x] Phase 3 — Catalog (Pre-Sale events, cookie designs, packaging options) — backend + idempotent demo
  seed script; admin CRUD UI deferred (seed script covers this demo)
- [x] Phase 4 — Pre-Sale order workflow (browse → quantity → packaging → invoice → guest/authed checkout)
  — full backend + web wizard, verified end-to-end locally
- [ ] Phase 5 — Custom order workflow — intentionally skipped for this demo (needs more detail)
- [x] Phase 6 — Payments (Stripe deposit via `IPaymentProvider`, webhook handling) — backend + Stripe
  Elements web UI built; untested with real Stripe test keys (see setup above)
- [x] Phase 7 — Order management (status state machine, admin list/update routes) — backend only; no
  admin dashboard or customer order-history UI yet
- [ ] Phases 8–9 — newsletter sending, hardening

