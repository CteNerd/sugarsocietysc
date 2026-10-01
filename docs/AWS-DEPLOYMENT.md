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

CloudWatch alarms are created for API 5xxs, the guest-contact purge, newsletter worker errors, and the
newsletter DLQ. Their state is visible in CloudWatch; an alert email/SNS destination still needs to be
chosen and configured before relying on notifications.

The managed WAF rules are attached to the CloudFront website distribution; they do not protect the
direct API Gateway HTTP API endpoint. Choose and configure an API-edge/rate-limiting approach before
production cutover, and verify the API's allowed origins and abuse controls separately.

The workflow checks out code, installs dependencies, runs workspace type-check/tests/build, synthesizes
the selected environment, assumes the role, deploys CDK, reads API/Cognito/Web outputs, builds the
frontend with those values, syncs assets, invalidates CloudFront, and checks `/health`.

## First dev run and production cutover

Run Actions → Deploy to AWS → Run workflow → `dev` only after the environment variables, OIDC role,
CDK bootstrap, domain/certificate, Cognito redirects, SES-verified sender, and runtime Secrets Manager
secrets are ready.
Review workflow output and smoke-test sign-in, checkout/webhook, campaign delivery, and admin APIs.
Do not select `prod` until production protection requires an approval and the production rollback/DNS
plan is ready. Production DNS changes must be made by an authorized operator; the workflow does not
modify external DNS.
