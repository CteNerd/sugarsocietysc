# Roadmap & Architecture Decisions

This is the living plan for the Sugar Society SC platform build-out. Update the **Phase Status** section
at the end of every phase. This file is the source of truth for scope/decisions — if you're starting a
new session, read this file first.

## Scope

1. Newsletter signup (admin-sent, optional membership upsell)
2. User accounts (signup/login, email confirmation, order history, newsletter subscribe/unsubscribe)
3. Order workflow: pre-sale (admin-curated designs/dates) + custom (base → icing/design → packaging →
   invoice → Stripe deposit)
4. Order management (status state machine, admin dashboard, customer read-only history)
5. Newsletter sending (email + SMS, admin-composed)

Plus: AWS (CDK) + CI/CD, ports-and-adapters/SOLID architecture, OAuth-ready Cognito auth, mature security
posture. Custom-order workflow remains future work and is excluded from the current completion scope.

## Key decisions

| Area | Decision |
|---|---|
| Backend runtime | Node.js/TypeScript on Lambda (`aws-cdk-lib` `NodejsFunction`) |
| Database | Aurora Serverless v2 (PostgreSQL) — **no ORM**, raw parameterized SQL via `pg`, `node-pg-migrate` for schema |
| Auth | Amazon Cognito User Pools + Hosted UI, OAuth/social federation (Google, etc.) supported from day one |
| SMS | Amazon SNS now, abstracted behind `ISmsProvider` so Twilio can be swapped in later with zero caller changes |
| Payments | Stripe via `IPaymentProvider` (deposit now, swappable later) |
| Storage | S3 via `IStorageProvider`, presigned URLs only, private bucket |
| Hosting | Migrate frontend from GitHub Pages to S3 + CloudFront, unified under the same CDK app |
| Environments | `dev` + `prod`, single AWS account, separate CDK stacks per env |
| Checkout | Guest checkout allowed (`guestEmail` + `guestPhone` both required); account-claim flow links past guest orders to a new/existing account by email |
| Guest PII retention | Scheduled job purges `guestEmail`/`guestPhone` N days after order `complete`/`cancelled` (config value, not hardcoded) — order record itself is retained |
| Lambda granularity | Per-domain Lambda (health, auth-sync, newsletter, catalog, orders, admin, webhooks-stripe), each a small `hono` app |
| Local dev | `docker-compose` (Postgres + LocalStack + cognito-local) + `npm run dev`, no AWS account needed day-to-day |
| Repo AI tooling | `.github/copilot-instructions.md`, scoped `*.instructions.md`, `infra-agent`/`api-agent`, skills — see [below](#repo-ai-tooling) |

See [Local dev vs. real AWS](#local-dev-vs-real-aws) below for the local-first delivery strategy.

## Repo structure

```
packages/
  web/      React (CRA) frontend
  api/      Node/TypeScript Lambda backend (hono), raw SQL via pg (no ORM)
  infra/    AWS CDK (TypeScript) — Network/Data/Auth/Api/Web stacks
  shared/   Shared TS types + zod schemas used by both web and api
```

## Core data model (Postgres)

- `User(id, cognitoSub, firstName, lastName, email, phone, role[customer|admin], newsletterOptInEmail, newsletterOptInSms, isActive, createdAt)`
- `HolidayPreference(userId, holidayTag)`
- `NewsletterSubscriber(id, email, phone?, userId?, emailOptIn, smsOptIn, subscribedAt, unsubscribedAt?, source)`
- `NewsletterCampaign(id, title, subject, bodyHtml, bodyText, smsBody, scheduledAt?, sentAt?, createdBy, status[draft|scheduled|sent])`
- `NewsletterSendLog(id, campaignId, subscriberId, channel[email|sms], status[sent|failed|bounced], sentAt)`
- `PreSaleEvent(id, name, holidayTag, orderWindowStart, orderWindowEnd, pickupDate, isActive)`
- `MenuCategory(id, preSaleEventId, name, description?, sortOrder, isActive)`
- `CookieDesign(id, name, description?, imageUrls[], preSaleEventId?, categoryId?, sortOrder, type[presale|custom-catalog], colors[], maxQuantity, quantitySold)`
- `MenuItemVariant(id, cookieDesignId, label?, packSize, priceCents, sortOrder, isActive)`
- `BaseCookieOption(id, name, price, isActive)`
- `IcingOption(id, type[solid-color|custom-print], name, price)`
- `PackagingOption(id, name, price, type[box|addon], isActive)`
- `Order(id, userId?, guestEmail?, guestPhone?, orderNumber, type[presale|custom], preSaleEventId?, status[received|payment_received|ready_for_pickup|complete|cancelled], pickupDate, subtotal, tax, depositAmount, depositPaidAt?, total, stripePaymentIntentId, createdAt, updatedAt)`
- `OrderItem(id, orderId, cookieDesignId?, variantId?, itemName?, variantLabel?, packSize?, baseCookieOptionId?, icingOptionId?, customDesignImageUrl?, colorSelection?, quantity[packs for new Pre-Sale orders], unitPrice, lineTotal)`
- `OrderPackaging(id, orderId, packagingOptionId?, addOnOptionIds[], quantity, price)`
- `OrderStatusHistory(id, orderId, status, changedByAdminId, changedAt, note)`
- `PaymentTransaction(id, orderId, provider, providerRef, amount, type[deposit|balance], status, createdAt)`

## Ports & adapters (SOLID)

- `IEmailProvider` → `SesEmailProvider`
- `ISmsProvider` → `SnsSmsProvider` now; add `TwilioSmsProvider` + one factory case later, no caller changes
- `IPaymentProvider` → `StripePaymentProvider`
- `IStorageProvider` → `S3StorageProvider`
- Repository-per-aggregate, raw parameterized SQL, no ORM
- Composition via plain factory functions reading `AppConfig` (no DI framework, keeps Lambda cold starts low)

## Repo AI tooling

- [.github/copilot-instructions.md](../.github/copilot-instructions.md) — project-wide conventions + model guidance
- `.github/instructions/{infra,api,web}.instructions.md` — scoped conventions per package
- `.github/agents/{infra-agent,api-agent}.agent.md` — specialized subagents
- `.github/skills/{add-new-domain-endpoint,add-db-migration,add-cdk-stack-resource}/SKILL.md` — repeatable task recipes

## Local dev vs. real AWS

Build and test as much as possible locally (docker-compose: Postgres + LocalStack + cognito-local) before
touching real AWS, to control cost and session/token usage.

**Fully local**: Phase 1 core auth (signup/login/JWT/Postgres sync), Phase 2 newsletter signup, Phase 3
catalog/pricing, Phases 4–5 order workflows (incl. S3 image upload via LocalStack), Phase 6 payments
(Stripe test mode + `stripe listen` for webhooks), Phase 7 order management.

**Requires a real deployed AWS dev environment**:
1. Google OAuth / social login end-to-end (cognito-local has no Hosted UI / external IdP federation)
2. Real email/SMS delivery verification (Phase 8) — LocalStack fakes the API calls but doesn't deliver;
   SES also needs a production-access request (AWS review lead time — request early)
3. CloudFront/WAF/Route53 domain cutover, Cognito advanced security (Phase 9 + Web stack cutover)
4. Validating the actual GitHub Actions → AWS CI/CD pipeline (OIDC role, `cdk bootstrap`, `cdk deploy`)

**Recommended checkpoints**: build Phases 1–7 locally first, deferring `cdk deploy` entirely. Do a single
AWS checkpoint once Phase 1 is otherwise done (deploy Network/Data/Auth, register Google OAuth, verify
federated login, then return to local-only work). A second checkpoint around Phase 8 for real send
verification (request SES production access early). Final checkpoint for Phase 9 hardening + domain
cutover. Aurora Serverless v2 bills continuously once deployed — consider `cdk destroy` between
checkpoints if cost-sensitive (snapshot first to keep data).

## Phases & status

- [x] **Phase 0 — Foundation**: monorepo restructure, CDK stack skeletons (Network/Data/Auth/Api/Web,
  synth-validated, not deployed), local dev stack, repo AI tooling, README. *(not yet deployed to AWS)*
- [x] **Phase 1 — Auth & Accounts**: Cognito-compatible signup/login/JWT verification,
  `auth-sync` domain (repository/service/routes + tests), `requireAuth` hono middleware (works with or
  without API Gateway's JWT authorizer), `users`/`holiday_preferences` migration, cognito-local seed
  script, frontend signup/confirm/login/account pages + `AuthContext` + `ProtectedRoute`.
  Google OAuth sign-in has been successfully verified by the owner. AWS environment deployment state
  and production OAuth redirect configuration still need to be confirmed as part of the AWS rollout.
- [ ] **Phase 2 — Newsletter signup**: subscribe/unsubscribe, optional member upsell, account settings toggle
  - [x] `newsletter_subscribers` migration, `newsletter` domain (repository/service/routes + tests),
    `/newsletter/subscribe` + `/newsletter/unsubscribe` (public), `/newsletter/preferences` (authed,
    keeps `users.newsletter_opt_in_*` in sync), CDK `NewsletterFn` + HTTP API routes (local-only so far).
  - [x] Frontend: footer `NewsletterSignup` widget (guest subscribe + account-creation upsell on success),
    `/newsletter-unsubscribe` landing page, `Account` page email/SMS preference toggles.
  - [ ] Admin member upsell messaging/copy review; real SES/SNS delivery verification is part of Phase 8/AWS dev.
- [x] **Phase 3 — Catalog & admin pricing**: concurrent Pre-Sale events, categories, cookie designs, fixed-price
  pack variants, event-specific optional packaging/add-ons, API routes and admin CRUD UI. `GET
  /catalog/presale/events` lists open/upcoming events; `/catalog/presale/events/:id` returns one categorized
  menu. `GET /catalog/presale/active` remains a compatibility alias.
- [x] **Phase 4 — Pre-sale order workflow**: choose an event → select pack variants and quantities → optional
  packaging/add-ons → review invoice → guest or signed-in checkout. The API verifies event membership,
  prices exclusively from database variants, and reserves `packs × packSize` units. Order lines preserve
  item/variant labels, pack size and price snapshots; Stripe PaymentIntent descriptions and bounded metadata
  include the event and itemization.
  *(Explicitly excludes custom/Asana-based ordering — that's Phase 5.)*
- [ ] **Phase 5 — Custom order workflow** *(excluded from the current completion scope; retain as future work)*
- [x] **Phase 6 — Payments**: Stripe deposit (50%) via `IPaymentProvider`/Stripe adapter, PaymentIntent
  created on order creation, `payment_transactions` ledger, Stripe Elements (`PaymentElement`) on the web
  wizard, `/webhooks/stripe` handling `payment_intent.succeeded`, CDK `WebhooksStripeFn` + Secrets
  Manager-backed Stripe credentials (imported, not created, by CDK). **Untested with real Stripe test
  keys** — verified up to the live Stripe API call locally (fails only on the placeholder key, as
  expected); see README for the real test-key setup needed to complete this.
- [x] **Phase 7 — Order management**: status state machine (repository/service + tests) covering
  received → confirmed → ready → completed/cancelled transitions, admin list/update routes
  (`/orders/admin`, `requireAdmin` middleware), admin catalog/order dashboard, and customer order history.
- [x] **Phase 8 — Newsletter sending**: admin-composed plain-text content within the fixed branded email
  template (logo/signature); simple SMS text with optional URLs; SQS fan-out, preference filtering,
  idempotent send log, and admin campaign controls. Live SES/SNS delivery remains an AWS-dev validation.
- [ ] **Phase 9 — Hardening and AWS release**: guest PII purge, OWASP pass, WAF/CloudWatch controls,
  GitHub Actions OIDC-based deployment to AWS, SES/SNS and Stripe verification, and domain cutover.
  Guest PII retention, CloudFront WAF, CloudWatch alarms, API throttling, and the manual deployment
  workflow are implemented. The WAF currently protects the CloudFront website only; the API has explicit
  API Gateway throttling. The owner must configure GitHub
  Environment variables, AWS OIDC trust/permissions, CDK bootstrap, runtime secrets, SES sender
  verification, and external DNS/certificate prerequisites. The production Google OAuth client ID is
  client IDs are configured in CDK; verify the Google client secret and Cognito redirect URI before
  production sign-in. Admin promotion is restricted to verified Google identities on the configured
  email allowlist/domain. Real Stripe/SES/SNS checks and production cutover remain; production changes
  require explicit approval.
