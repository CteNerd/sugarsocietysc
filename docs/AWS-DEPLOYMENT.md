# AWS Deployment Setup

The `Deploy to AWS` GitHub Actions workflow is manual-only. It deploys to the selected `dev` or `prod`
GitHub Environment, then publishes the CRA build to the private S3 bucket and invalidates CloudFront.
It first calls the same `Release CI` validation used for PRs/main, without AWS credentials. Only the
deployment job requests an OIDC token; production dispatches must select `main`.
Production should be configured with required reviewers in GitHub Environment protection rules before
using the workflow.

## GitHub configuration

Create `dev` and `prod` GitHub Environments under Settings → Environments. Configure these **variables**
in each environment. Require reviewers for `prod` and restrict its deployment branches to `main`;
restrict `dev` to the branches your team intends to deploy.

Configure branch protection/rulesets for `main` to require **Release gate** from
[Release CI](../.github/workflows/ci.yml), and require branches to be up to date before merging.
The gate always runs, including documentation-only PRs, and requires successful API, infrastructure,
and frontend jobs. Workflow changes do not configure repository protection automatically.

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Must match that environment's `packages/infra/cdk.json` region. |
| `AWS_ACCOUNT_ID` | AWS account the workflow is allowed to deploy into; the workflow checks the assumed account. |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN that trusts this repository's GitHub OIDC identity. |
| `WEB_DOMAIN_NAME` | Frontend host configured for that environment in CDK (for example, dev or production host). |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for the matching environment; this is public frontend configuration, not a secret. |
| `NEWSLETTER_FROM_EMAIL` | SES-verified sender address for campaign email in the matching AWS account/region. |
| `NEWSLETTER_SIGNATURE` | Standard email signature displayed below admin-composed campaign text; defaults to the business name if omitted. |
| `RECAPTCHA_SITE_KEY` | Public Google reCAPTCHA v2 checkbox site key for the matching environment's website domain. |

No long-lived AWS access key is needed in GitHub, and the workflow needs no GitHub Actions secrets:
it requests short-lived credentials through GitHub OIDC. Keep Stripe secret/webhook keys, Google OAuth
client secret, and database credentials in AWS Secrets Manager, not GitHub Actions or source control.
Cognito, API, bucket, and distribution values are read from deployed CloudFormation outputs by the
workflow.

## Google reCAPTCHA for the Contact form

1. Open the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create) and register
   a site using **Challenge (v2)** → **"I'm not a robot" Checkbox**.
2. Add the exact website host for each environment to its allowed domains. Add `localhost` for local
   development. Google provides a public **site key** and a private **secret key**.
3. Set the public site key as the `RECAPTCHA_SITE_KEY` variable in each matching GitHub Environment.
   The deploy workflow exposes it only to the frontend build as `REACT_APP_RECAPTCHA_SITE_KEY`.
4. Store the private key in the SecretString of an AWS Secrets Manager secret named
   `sugarsocietysc/dev/google-recaptcha` or `sugarsocietysc/prod/google-recaptcha`, formatted as JSON:
   `{ "secretKey": "<Google reCAPTCHA secret key>" }`. The API Contact Lambda reads the `secretKey`
   value; do not put the private key in GitHub variables or frontend configuration.
5. For local development, put `REACT_APP_RECAPTCHA_SITE_KEY` and `GOOGLE_RECAPTCHA_SECRET` in the
   root `.env.local` file. Use a test key pair or a site key registered for `localhost`. Restart the
   web and API dev servers after changing the file.

Contact requests are stored in the database, emailed to the two Sugar Society contact addresses, and
purged from the database after 365 days by the existing daily contact-retention schedule. The email
sender uses the environment's SES-verified `NEWSLETTER_FROM_EMAIL`.

## AWS OIDC and CDK bootstrap

Before the first workflow run, an AWS administrator must:

1. Add GitHub's OIDC identity provider (`token.actions.githubusercontent.com`) to the target AWS account
   if it is not already present.
2. Create the deploy IAM role ARN configured as `AWS_DEPLOY_ROLE_ARN`. Its trust policy must restrict
   `token.actions.githubusercontent.com:aud` to `sts.amazonaws.com` and the `sub` claim to this
   repository and the corresponding GitHub Environment (`repo:CteNerd/sugarsocietysc:environment:dev`
   or `repo:CteNerd/sugarsocietysc:environment:prod`), rather than allowing arbitrary repositories or
   branches.
3. Grant the role permission to assume the environment's CDK bootstrap deployment/file-publishing
   roles, and permission to read the named CloudFormation outputs, publish to the WebStack bucket,
   invalidate its CloudFront distribution, invoke the migration Lambda, and query its AWS account
   identity. Lean-rollout preflights also require `cloudformation:ListStackResources` on the selected
   API stack and `lambda:GetFunctionConfiguration` on its functions. The CloudFormation execution
   role must support EventBridge Scheduler schedule groups and the scoped Scheduler execution role.
   CDK bootstrap roles must trust this deploy role. Keep the production role/environment
   separately protected. The CDK CloudFormation execution policy also needs scoped service permissions
   for resources in these stacks (including SQS, Lambda, SES `SendEmail`, WAF, CloudWatch, Cognito,
   Aurora, S3, and CloudFront), plus full lifecycle permissions — not just `sns:Publish` — for the
   environment's alarm topic (`arn:aws:sns:<region>:<account>:sugarsocietysc-<env>-alarms`):
   `sns:CreateTopic`, `sns:SetTopicAttributes`, `sns:GetTopicAttributes`, `sns:TagResource`,
   `sns:Subscribe`, `sns:Unsubscribe`, `sns:ListSubscriptionsByTopic`, `sns:Publish`, and
   `sns:DeleteTopic` — otherwise CDK fails to create/update the topic and its email subscription on
   deploy.
4. Bootstrap each account/region once with the repository's CDK version and approved CloudFormation
   execution policy. Review the policy and planned stack changes before the first deployment.
5. Confirm the imported ACM certificate is issued in `us-east-1`, covers the environment's configured
   web domain, and is valid. DNS remains externally managed.

CloudWatch alarms (API 5xxs, inventory-hold-expiry errors, guest-order and contact-submission purges, newsletter worker
errors, and the newsletter DLQ) publish to a per-environment SNS topic
(`sugarsocietysc-<env>-alarms`), which emails `environments.<env>.alertEmail` from `cdk.json`. AWS
sends a confirmation email to that address on first deploy — someone must click it before
notifications start flowing.

The managed WAF rules are attached to the CloudFront website distribution only; AWS WAFv2 cannot attach
directly to an HTTP API (API Gateway v2). Instead, the HTTP API's default stage has an explicit
per-environment throttle (50 req/s steady-state, burst 100) to cap abuse/runaway traffic beyond the
account-wide default. This is rate-limiting only — it does not provide managed rule groups (SQLi, XSS,
bad-bot signatures, etc.) the way the website's WAF does. If/when the API is exposed to more
general-purpose automated callers (for example an MCP-style integration), revisit putting a CloudFront
distribution (with its own WAF Web ACL) in front of the HTTP API instead of calling its `execute-api`
endpoint directly — that change affects the public API URL and requires re-registering the Stripe
webhook endpoint.

### API default stage logical IDs

The deployed API stacks have different CloudFormation logical IDs for their `$default` stage:
dev uses `HttpApiDefaultStage3EEB07D6`, while prod uses `HttpApiDefaultStage439BF176` because it was
first deployed with a standalone `HttpStage`. `ApiStack` preserves the prod logical ID when
configuring the built-in default stage. Keep this override: removing it makes CloudFormation try
to create a second `$default` stage on the same API and fail early validation with "already exists".
Do not delete the existing stage to work around this error; preserving its logical ID updates it
in place and keeps the API URL and throttling settings unchanged.

The shared Node 22 release checks cover API/shared types and builds, API unit and PostgreSQL integration
tests, infrastructure types/assertions and dev/prod synth, and frontend tests plus a strict production
build. A failed, skipped, or cancelled job fails the release gate and blocks the manual deployment.
After validation, the deployment job synthesizes the selected environment once, validates settings,
assumes the role, checks rollout prerequisites, and deploys that exact cloud assembly. It requires
nonempty API/Cognito/Web outputs and a successful migration response, checks `/health` before frontend
publication, builds the frontend with deployed values, syncs assets, waits for CloudFront invalidation,
and runs health plus deployed API/browser smoke tests. HTTP smoke tests and job durations are bounded; production environment approval
is still required independently of CI success.

### Deployed-environment smoke tests

The [Deployed smoke tests workflow](../.github/workflows/deployed-smoke.yml) is called after successful
deployment and can also be dispatched manually with `web_url` and `api_url` HTTPS origins to test
already deployed code without changing AWS resources. When newly adding a workflow on a PR branch,
GitHub may not offer manual dispatch until it exists on the default branch; the local command below
works before merge. The workflow uses no AWS credentials or test accounts.

```bash
npx playwright install chromium
SMOKE_WEB_URL=https://dev.sugarsocietysc.com \
SMOKE_API_URL=https://YOUR_API.execute-api.us-east-1.amazonaws.com \
npm run test:smoke
```

Both URLs are required and validated; there is no implicit production target. Ten checks cover:

- Actual database connectivity via `/health`, public event listing and a detail read when events exist,
  invalid identifier handling, and anonymous admin catalog rejection.
- Desktop and mobile Chromium: home rendering, navigation to the contact form, SPA deep links,
  anonymous admin-to-login redirect, and pre-sale rendering with the **expected real API**, not mocks.
- Empty catalogs are valid and reported, not seeded automatically. They do not prove menu or checkout
  readiness. Browser navigation waits for DOM readiness and asserts application content instead of
  waiting for unrelated external images to finish loading.

Tests make only read requests; browser writes are blocked and fail the suite. They do not log in,
create users/orders, reserve inventory, submit contact/newsletter forms, or trigger payment/webhook
or message delivery. Authenticated admin parity, Stripe test-mode checkout/refunds, Scheduler
delivery, privacy purges, alarm delivery and pause/resume behavior still need separately approved
fixtures and acceptance checks. Mobile coverage emulates a phone in Chromium, not real iOS/Safari.

The smoke job has a ten-minute timeout, the suite a five-minute deadline, and no automatic retries.
A failure makes the deployment workflow fail **after publication**; this is detection, not automatic
rollback. Inspect the uploaded HTML report, failure screenshots and traces (seven-day retention)
before deciding whether to fix forward or use the rollback procedure.

## Lean Data API rollout

The November 3 dev deployment of `abeb0f74` completed migrations and frontend publication. Read-only
assessment confirmed all 13 API stack Lambdas use Data API without VPC attachment, Aurora PostgreSQL
16.13 has its HTTP endpoint enabled with 0.5-2 ACU capacity, polling remains enabled, and dev NAT is
retained. Database health and an empty public catalog succeeded. This does not certify checkout,
scheduled expiration, pause/resume or production rollout.

The operating target is AWS-only hosting, one
persistent production environment, local `pg` development, and temporary staging. Keep PostgreSQL
repositories and SQL transactions; only the transport changes in AWS. All live changes below need
explicit operator approval.

### Validation before rollout

```bash
npm run lint
npm run test --workspace=@sugarsocietysc/api
npm run test:integration --workspace=@sugarsocietysc/api
npm run validate:lean --workspace=@sugarsocietysc/infra
npm run synth:dev --workspace=@sugarsocietysc/infra
npm run synth:prod --workspace=@sugarsocietysc/infra
CI=true npm run test --workspace=@sugarsocietysc/web -- --watchAll=false --runInBand
CI=true npm run build
```

The integration suite downloads a platform-specific PostgreSQL 16 executable during dependency
installation, binds only loopback on a temporary port, creates synthetic databases, and removes its
own temporary directory afterward. Normal `npm ci` runs the native package's symlink setup; if you
installed with `--ignore-scripts`, rebuild the installed `@embedded-postgres/<platform>` package.
It executes real SQL, migrations, locks, oversell/payment/expiry races, and rollback, but emulates
the Data API wire response. Migration clients and every pooled connection's close event are awaited
before server shutdown to avoid connection-termination races on Linux CI; `Pool.end()` alone can
return before sockets close. CI runs it without an AWS account or Docker.

### Approved deployment sequence

1. **Confirm recovery and alerts first.** Verify a usable production snapshot/PITR policy and test
   restoration in staging. Verify the production SNS alarm topic has an actual confirmed subscriber
   and delivers a test notification: the billing investigation found none despite a previously
   successful CloudFormation subscription. Source code is not proof of delivery.
2. **Deploy the transport without changing expiration or idle capacity.** Keep
   `inventoryExpiryMode: "polling"`, `auroraMinCapacity: 0.5`, and `natGateways: 1` in the selected
   CDK environment. Review the change set: enable the existing cluster's HTTP endpoint and remove
   Lambda VPC attachment, not replace the database. Cluster, subnet, security-group, API-stage logical
   IDs and legacy exports are preserved. AWS runtime uses `DATABASE_DRIVER=data-api`,
   `DB_CLUSTER_ARN`, `DB_SECRET_ARN`, and `DB_NAME`; Data API authorization remains scoped to the
   cluster and its managed secret. Existing DB host/port exports remain for staged rollback.
3. **Apply bundled migrations and test the real runtime.** The workflow invokes the migration
   Lambda after deploying. The Data API runner keeps the existing `pgmigrations` history, generates
   SQL through node-pg-migrate, executes statements sequentially in one transaction, and acquires a
   transaction-level advisory lock. Test health, catalog arrays/dates, auth/admin access, newsletter
   persistence, contact queue delivery, guest checkout, simultaneous final-stock checkout, Stripe
   test-mode success/duplicate/late webhook refunds, and privacy purges in temporary staging.
   Do not switch to live payments or certify transport compatibility from local tests alone.
4. **Enable scheduled expiry while retaining 0.5 ACU.** Change only `inventoryExpiryMode` to
   `"scheduled"` and review/synth/deploy with approval. The workflow performs a read-only prerequisite
   invocation of the *already deployed* migration Lambda with
   `{"checkInventoryExpiryReady":true}`; an old Lambda or missing table blocks this deployment.
   For manual CDK operations, perform that check yourself before deployment.
   Checkout atomically records a durable task with its reservation. Deterministic one-time Scheduler
   events release only the selected unpaid order; duplicate deliveries and paid orders do not
   release sold stock. Scheduling failures are logged and left for reconciliation, not retried as
   duplicate checkouts. Verify Scheduler creation/delivery, scoped pass-role trust, failure queues,
   alarms, premature/duplicate events, and payment/expiration races in AWS.
5. **Opt in to pause only after latency acceptance.** Set `auroraMinCapacity: 0`,
   keep scheduled mode, and set `auroraAutoPauseSeconds` (300-86400; default 300). The context parser
   rejects zero ACU with polling. Aurora PostgreSQL 16.13 is configured; verify the deployed engine
   and region still support zero ACU. Measure actual pause periods, cold API latency, resume
   rejections, checkout/webhook behavior, and queue redelivery after resume. Accept the measured UX
   and alarm behavior before production. Keep 0.5 ACU if cold latency is unacceptable.
6. **Remove NAT independently.** Only after every deployed Lambda has no VPC attachment and legacy
   private-subnet/security-group imports are no longer consumed, set that environment's
   `natGateways: 0`. The workflow checks every currently deployed API Lambda has no VPC and selects
   Data API before allowing this change. Review an explicitly approved Network-only change set/deployment; do not combine
   this with the first transport rollout. Existing subnet logical IDs/exports remain, while the NAT
   and its public IPv4 are removed. This is the first guaranteed idle-network saving.
7. **Retire permanent dev deliberately.** Export or preserve any wanted dev data/configuration,
   test rebuilding temporary staging, and approve its teardown separately. Dev removal policies
   may destroy its database; never use a blanket destroy as an unreviewed cost fix. Keep prod
   deletion protection, backups, privacy retention, secrets, queues and alarms. WAF removal is not
   part of this change.

### Timing, scaling and migration limits

- Scheduler has minute-level precision, not exact-second expiry. SQL timestamps remain authoritative:
  expired reservations stop reducing available stock even if an order's status cleanup lags.
- Hourly reconciliation wakes Aurora; daily privacy purges and normal traffic also prevent continuous
  sleep. Reconciliation processes up to 100 pending tasks per invocation and performs the legacy
  expiry sweep. During a scheduling/delivery outage, cleanup may lag by an hour or longer with a
  backlog; monitor failures and run an approved dispatcher invocation to drain/recover tasks.
- Accepted expiry Lambda failures and exhausted Scheduler delivery failures reach a 14-day failure
  queue with an alarm. The durable SQL task also enables reconciliation when no Lambda invocation
  was accepted. Queued contact/newsletter workloads and privacy retention remain unchanged.
- Data API reads use the writer, responses must stay within 1 MiB and 64 KiB per row, and each query
  needs an HTTP round trip. Add pagination for growing administrative datasets. Large reports,
  streaming/COPY, session-level settings, and read-replica routing require a separate execution path.
- Calls on one transaction are serialized. Transactions expire after three minutes of inactivity;
  migrations are also bounded by the 60-second migration Lambda timeout. Keep migration batches
  short. Nontransactional migrations and builders requiring a live `pg` session are rejected,
  rather than silently applied partially; approve a dedicated runner for those migrations.
- SDK retries are disabled for Data API. Only explicit `DatabaseResumingException` rejections retry,
  up to five waits totalling 15 seconds. Ambiguous network errors and commits are not blindly replayed.
  Application/Stripe idempotency and live latency checks remain essential.
- SQL stays parameterized with explicit UUID/array/timestamp casts. UUID-looking Cognito subjects and
  Stripe references remain text. Vendor-specific transport is confined to the database adapter;
  future domain endpoints retain PostgreSQL relationships and transactions.

### Rollback and cost confirmation

Before NAT removal, rollback can restore the previous VPC/`pg` runtime because subnet/secret/endpoint
exports are retained. Do not undo migration history or drop the outbox during runtime rollback.
If reverting after NAT removal, restore the Network NAT first before restoring any VPC-attached
Lambda. Disable pause by restoring minimum 0.5 ACU; restore polling only after pausing is disabled.
If scheduled processing fails, alert, invoke the expiry sweep/dispatcher with operator approval,
and confirm held stock, paid orders, late refunds and durable tasks reconcile.

After approved changes, compare tagged Cost Explorer service/usage charges and Aurora pause metrics
over representative idle and ordering periods. No savings are claimed by this PR. Keep the detailed
billing investigation locally as historical evidence, not a deployed-state record.

## DNS (Squarespace, not Route53)

This domain's real DNS is managed in Squarespace (migrated from Google Domains), not Route53 — CDK
never touches Route53 for it. After each environment's first successful deploy, read the
`WebDistributionDomain` CloudFormation output and create/update a CNAME in Squarespace's DNS panel:

| Record | Points to |
| --- | --- |
| `dev.sugarsocietysc.com` | dev `WebStack`'s `WebDistributionDomain` output |
| `www.sugarsocietysc.com` | prod `WebStack`'s `WebDistributionDomain` output |

## Switching Stripe to the live account (production)

1. In the Stripe Dashboard, switch to **Live mode** and copy the live publishable key
   (`pk_live_...`) and secret key (`sk_live_...`).
2. Update the `prod` GitHub Environment variable `STRIPE_PUBLISHABLE_KEY` to the live publishable key.
3. Create (or update) the `sugarsocietysc/prod/stripe` Secrets Manager secret with the live secret key
   and a placeholder webhook secret (the real one isn't known until step 5):
   ```bash
   aws secretsmanager create-secret \
     --name sugarsocietysc/prod/stripe \
     --description "Stripe live-mode credentials for Sugar Society SC prod (Pre-Sale deposits)" \
     --secret-string '{"secretKey":"sk_live_...","webhookSecret":"whsec_placeholder"}'
   ```
   (Run this yourself rather than pasting the live secret key into chat. Use `put-secret-value`
   instead of `create-secret` if the secret already exists.)
4. Run the `Deploy to AWS` workflow for `prod`. This deploys the API Gateway and gives you the live
   `HttpApiUrl` output (also visible in the workflow logs / CloudFormation console).
5. In the Stripe Dashboard (live mode) → Developers → Webhooks, add an endpoint at
   `<prod HttpApiUrl>/webhooks/stripe`, subscribe it to the events the app already handles in dev, and
   copy the generated signing secret (`whsec_...`).
6. Update the real webhook secret into the same Secrets Manager secret:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id sugarsocietysc/prod/stripe \
     --secret-string '{"secretKey":"sk_live_...","webhookSecret":"whsec_..."}'
   ```
   No redeploy is required — Lambdas read the secret at cold start, so new invocations pick it up
   automatically (existing warm instances pick it up after their next cold start).
7. Send a real test webhook event from the Stripe Dashboard and confirm it's processed (check
   CloudWatch logs for `WebhooksStripeFn`).

## Enabling Google sign-in for an environment

The dev and prod Google OAuth Client IDs are already configured as
`environments.<env>.googleOAuthClientId` in `packages/infra/cdk.json`. Before deploying, verify the
existing Google OAuth clients and complete these environment-specific checks:

1. In Google Cloud Console → APIs & Services → Credentials, confirm the authorized redirect URI
   includes the exact Cognito callback shown by the `GoogleRedirectUri` output from the environment's
   `Auth` stack (`https://<hosted-ui-domain>/oauth2/idpresponse`). The app callback
   (`https://<domainName>/auth/callback`) is configured on the Cognito app client, not as Google's
   provider callback.
2. Confirm the matching client secret is present in the `GoogleOAuthClientSecret` Secrets Manager
   secret (`sugarsocietysc/<env>/google-oauth-client-secret`). Its value must be a JSON object with a
   `clientSecret` key because `auth-stack.ts` reads it via `secretValueFromJson('clientSecret')`:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id sugarsocietysc/<env>/google-oauth-client-secret \
     --secret-string '{"clientSecret":"<google-client-secret>"}'
   ```
   Run that command yourself only if the secret needs to be populated or rotated; never paste the
   secret into source control or chat.
3. The dev and prod CDK contexts already include the `ADMIN_EMAILS` allowlist and
   `ADMIN_EMAIL_DOMAIN=sugarsocietysc.com`. Keep the list restricted to individually approved
   employees; the domain by itself does not grant admin access. The API promotes an account only when
   it is on the allowlist, has a verified email on the configured domain, and its Cognito token
   contains a Google federated identity. If Google supplies an `hd` claim, it must match the configured
   domain as well. Removing an address from the allowlist demotes it on the next profile lookup or
   auth sync and blocks admin requests immediately. Inactive users are never granted admin access.
   Existing-session reconciliation updates only identity/role fields, not contact details or
   newsletter preferences.
4. The Google identity provider must map `email_verified` to Google's `email_verified` attribute,
   in addition to email and names. `AuthStack` configures this explicitly. An absent mapping can
   allow successful Google login while leaving the user ineligible for admin access. Verify the
   mapping without exposing OAuth secrets:
   ```bash
   aws cognito-idp describe-identity-provider \
     --user-pool-id <environment-user-pool-id> \
     --provider-name Google \
     --query 'IdentityProvider.AttributeMapping'
   ```
5. Redeploy the environment only when the Cognito client/secret, attribute mapping, redirect registration, or allowlist
   configuration changes. Confirm an admin can sign in through the Google button and a non-allowlisted
   user cannot access admin API routes.

### Admin access parity smoke test

Perform these checks separately in dev and prod after an explicitly approved deployment; the
environments share eligibility policy, not user pools or database records.

1. Confirm both environments configure the same approved admin allowlist/domain and map
   `email_verified`. CDK synth checks infrastructure intent; inspect the deployed provider as well.
2. Log out and use **Sign in with Google** again for an allowlisted account. For an existing browser
   Google session, use a fresh session if necessary to complete a new provider login. Reloading an old
   ID token, or refreshing it without a new provider login, does not prove the mapped attribute has
   been populated.
3. Confirm `/auth-sync/me` reports an active admin profile, the navigation exposes every admin
   destination, and `/admin` loads. Verify section links work on mobile and desktop, including
   reloading `/admin#orders`. Check a protected admin API request succeeds.
4. Reload the page and confirm restored-session profile reconciliation preserves admin access and
   saved newsletter preferences. Log out and verify admin links disappear.
5. Sign in as a non-allowlisted customer and verify both the UI and protected admin API deny access.
   An allowlisted email/password identity must also remain ineligible; do not substitute email-only
   checks or manually promote a database record.
6. Check the storefront at narrow widths and on physical iPhone Safari: visible +/- controls,
   increment/decrement and stock limits, usable menu scrolling, no horizontal overflow, and
   accessible account/admin forms. Use Stripe test mode for any payment smoke test, never a
   production purchase as a layout check.

Profile verification failures show a retry action rather than a misleading access-denied state.
For an allowlisted identity that still fails eligibility, use sanitized API diagnostics for
verified-email/federation/domain claim presence; never log or share tokens, OAuth secrets, or PII.
Until the approved rollout and these real-login/device checks complete, live parity remains
unverified even when local tests and synth pass.

## First dev run and production cutover

Run Actions → Deploy to AWS → Run workflow → `dev` only after the environment variables, OIDC role,
CDK bootstrap, domain/certificate, Cognito redirects, SES-verified sender, and runtime Secrets Manager
secrets are ready.
Review workflow output and smoke-test sign-in, checkout/webhook, campaign delivery, and admin APIs.
Do not select `prod` until production protection requires an approval and the production rollback/DNS
plan is ready. Production DNS changes must be made by an authorized operator; the workflow does not
modify external DNS.
