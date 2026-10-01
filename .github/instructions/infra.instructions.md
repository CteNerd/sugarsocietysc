---
description: "Use when writing or modifying AWS CDK code under packages/infra: stacks, constructs, environment config, or CDK synth/diff/deploy workflows."
applyTo: "packages/infra/**"
---
# Infra (CDK) Conventions

- One stack class per concern (Network, Data, Auth, Api, Web) in `lib/`, instantiated from `bin/infra.ts`.
- Every stack constructor takes `EnvConfig` (from `lib/env-config.ts`) so dev/prod differences (NAT gateway
  count, Aurora capacity, domain name, retention windows) are data, not duplicated code.
- Never hardcode account IDs or domain names in stack code — read them from `cdk.json` context via
  `EnvConfig`.
- Aurora, Lambda-to-RDS security groups, and any data store must live in private/isolated subnets — never
  put stateful resources in public subnets.
- Secrets (DB credentials, API keys) must come from Secrets Manager (`rds.Credentials.fromGeneratedSecret`,
  `secret.grantRead(fn)`), never from plaintext environment variables in CDK code.
- Run `cdk synth` / `cdk diff` freely to validate changes. Do NOT run `cdk deploy` without explicit user
  confirmation — it provisions real, billable AWS resources.
