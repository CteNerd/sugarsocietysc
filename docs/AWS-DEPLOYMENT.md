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

No long-lived AWS access key is needed in GitHub, and the workflow needs no GitHub Actions secrets:
it requests short-lived credentials through GitHub OIDC. Keep Stripe secret/webhook keys, Google OAuth
client secret, and database credentials in AWS Secrets Manager, not GitHub Actions or source control.
Cognito, API, bucket, and distribution values are read from deployed CloudFormation outputs by the
workflow.

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
   for resources in these stacks (including SQS, Lambda, SES `SendEmail`, SNS `Publish`, WAF,
   CloudWatch, Cognito, Aurora, S3, and CloudFront).
4. Bootstrap each account/region once with the repository's CDK version and approved CloudFormation
   execution policy. Review the policy and planned stack changes before the first deployment.
5. Confirm the imported ACM certificate is issued in `us-east-1`, covers the environment's configured
   web domain, and is valid. DNS remains externally managed.

CloudWatch alarms (API 5xxs, inventory-hold-expiry errors, the guest-contact purge, newsletter worker
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

1. In Google Cloud Console → APIs & Services → Credentials, create an OAuth 2.0 Client ID (type: Web
   application) for this project, if one doesn't already exist for the target environment.
2. Add authorized redirect URIs matching Cognito's hosted UI callback for that environment (found in
   the deployed `Auth` stack's `CognitoHostedUiDomain` output, pattern
   `https://<hosted-ui-domain>/oauth2/idpresponse`) and the app's own callback
   (`https://<domainName>/auth/callback`).
3. Provide the generated Client ID and Client Secret.
4. The Client ID goes into `environments.<env>.googleOAuthClientId` in `packages/infra/cdk.json`
   (not secret). The Client Secret must be put into the `GoogleOAuthClientSecret` Secrets Manager
   secret CDK creates (`sugarsocietysc/<env>/google-oauth-client-secret`) via
   `aws secretsmanager put-secret-value`, never committed to source control.
5. Redeploy the environment so Cognito picks up the non-empty client ID and enables the Google
   identity provider.

## First dev run and production cutover

Run Actions → Deploy to AWS → Run workflow → `dev` only after the environment variables, OIDC role,
CDK bootstrap, domain/certificate, Cognito redirects, SES-verified sender, and runtime Secrets Manager
secrets are ready.
Review workflow output and smoke-test sign-in, checkout/webhook, campaign delivery, and admin APIs.
Do not select `prod` until production protection requires an approval and the production rollback/DNS
plan is ready. Production DNS changes must be made by an authorized operator; the workflow does not
modify external DNS.
