---
description: "Use when writing or modifying the React frontend under packages/web: routes, components, auth integration, or order/newsletter/admin UI."
applyTo: "packages/web/**"
---
# Web (React Frontend) Conventions

- CRA app (react-scripts), TypeScript, react-router-dom v7. Keep routing centralized in `src/App.tsx`.
- Shared types/DTOs come from `@sugarsocietysc/shared` — do not redeclare shapes already defined there.
- API calls go through a single typed API client module (one per domain), never ad-hoc `fetch`/`axios`
  calls scattered across components.
- Auth state (Cognito session/JWT) is read from a single auth context/provider; protected routes (account,
  admin) check this context, never component-local auth flags.
- Admin-only routes/components must assume they are NOT a security boundary by themselves — the API must
  independently enforce the `admin` role server-side.
