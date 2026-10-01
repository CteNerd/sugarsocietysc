---
name: add-cdk-stack-resource
description: 'Add a new AWS resource to an existing CDK stack or create a new stack in packages/infra, following the EnvConfig-driven, security-conscious conventions already established. Use when provisioning new AWS infrastructure.'
---

# Add a CDK Stack Resource

## When to Use
Provisioning a new AWS resource (queue, table, bucket, function, etc.) or a new stack entirely.

## Procedure
1. Decide which existing stack the resource belongs to (Network/Data/Auth/Api/Web) by concern — don't
   create a new stack unless it's a genuinely new concern.
2. Any value that differs between dev/prod (capacity, retention, domain, account) must come from
   `EnvConfig` (`packages/infra/lib/env-config.ts`) and `cdk.json` context — never hardcode it.
3. Stateful/sensitive resources (databases, secrets, uploaded files) go in private/isolated subnets with
   least-privilege security groups and IAM — grant access explicitly (`resource.grantRead(fn)`), never
   use wildcard IAM policies.
4. If the resource needs to be referenced by another stack, expose it as a `public readonly` property and
   pass it through stack props (see how `DataStack.cluster` flows into `ApiStackProps`).
5. Wire it into `bin/infra.ts` if it's a new stack.
6. Validate: `npm run synth:dev --workspace=@sugarsocietysc/infra` then `npm run diff:dev --workspace=@sugarsocietysc/infra`.
   Do not run `deploy:*` without explicit user confirmation.
