# AWS Deployment Setup

The `Deploy to AWS` GitHub Actions workflow is manual-only. It deploys to the selected `dev` or `prod`
GitHub Environment, then publishes the CRA build to the private S3 bucket and invalidates CloudFront.
Production should be configured with required reviewers in GitHub Environment protection rules before
using the workflow.

## GitHub configuration

Create `dev` and `prod` GitHub Environments under Settings → Environments. Configure these **variables**
in each environment. Require reviewers for `prod` and restrict its deployment branches to `main`;
restrict `dev` to the branches your team intends to deploy.

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
   identity. CDK bootstrap roles must trust this deploy role. Keep the production role/environment
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

The workflow checks out code, installs dependencies, runs workspace type-check/tests/build, synthesizes
the selected environment, assumes the role, deploys CDK, reads API/Cognito/Web outputs, builds the
frontend with those values, syncs assets, invalidates CloudFront, and checks `/health`.

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
