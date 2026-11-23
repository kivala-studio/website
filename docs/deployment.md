# Deployment and operations

## What the repository proves

| Fact | Source |
|---|---|
| The app is built with `next build` and served with `next start` | `package.json` |
| Node.js must be `>=22.12 <23` | `package.json` `engines`, `.nvmrc` |
| A build fails when a required variable is missing or invalid | `next.config.ts`, `src/config/env.ts` |
| A build fails when server-only content reaches a client chunk | `scripts/scan-client-bundle.mjs` |
| `scripts/statement-assets.mjs` must run before a build; `npm run build` does it through `prebuild` | `package.json` |
| The data mode is fixed at build time: `NEXT_PUBLIC_*` values are inlined, and `pageExtensions` depends on the mode | `src/config/public-env.ts`, `next.config.ts` |
| The code expects a Vercel-style environment in two places: the proxy matcher excludes `/_vercel`, and `NEXT_PUBLIC_VERCEL_ENV` is read | `src/proxy.ts`, `src/data/intelligence/feature-config.ts` |
| `.vercel` is ignored by git | `.gitignore` |
| A GitHub Actions workflow is defined for pull requests and pushes to `main`: `npm ci`, `npm run check`, `npm run build`, Playwright with three browsers, `npm run lhci`, in demo mode on Node from `.nvmrc`. It deploys nothing | `.github/workflows/ci.yml` |

## Not verifiable from the repository

- Where production is hosted and how a deployment is triggered. There is no `vercel.json`, no Dockerfile and no deployment step in the workflow. The owner states that merges to `main` deploy production.
- Which values production uses for any variable, including whether `APP_URL` is set.
- Whether the GitHub Actions workflow runs.
- The DNS and domain configuration of `invest.ao` and `dashboard.invest.ao`.
- The Supabase project's Auth settings (redirect allow-list, providers).
- Whether the PostHog flags `web-maintenance` and `web-maintenance-development` exist.

## Production configuration required by the code

- `NEXT_PUBLIC_DATA_MODE=production`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `SITE_URL`.
- For two hosts: `APP_URL` on a subdomain of the site's host, so the session cookie's parent domain covers both (`src/config/hosts.ts`).
- The OAuth redirect URL used is `<site origin>/auth/callback` (`src/app/auth/sign-in/route.ts`); the Supabase project must allow it.
- For Apple account deletion: `APPLE_WEBSITE_RECEIPT_SECRET`, matching the backend's secret, and a backend return URL that reaches `/api/account/apple-deletion/complete`.
- Optional: `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, the Android variables.

## Runtime behaviour to know

| Topic | Behaviour | Source |
|---|---|---|
| Maintenance | With the PostHog flag on, every page renders the maintenance screen. The state is cached per server process: refreshed at most every 300 s, a positive answer kept for 3600 s, fail-open | `src/data/flags/maintenance.ts` |
| Snapshot cache | `/api/market/snapshot` caches the upstream body in the memory of each server process | `src/data/market/snapshot-proxy.ts` |
| Data cache | Public reads use `unstable_cache` with the revalidation times in [architecture.md](architecture.md). The tags are defined but no code calls `revalidateTag` | `src/data/market/public-cache.ts` |
| Backend maintenance | The snapshot's `control.maintenance` slows polling to 300 s; it does not show the maintenance screen | `src/domain/market/refresh.ts` |
| Health | The app has no health-check route | `src/app` |
| Logs | The application code writes no logs of its own; crashes go to Sentry when configured | `src/instrumentation.ts` |
| Robots | Development routes are absent from production-mode builds | `next.config.ts` |

## Regenerated files

| File | Command | Input |
|---|---|---|
| `messages/pt.json`, `messages/en.json`, `messages/key-map.json` | `npm run messages` | The iOS string catalogue |
| `src/ui/icons/icon-pack.ts` | `npm run icons` | `design/icon-pack/masters.json` |
| `public/statement/**` (not tracked) | `predev`, `prebuild` | `node_modules` |
| `docs/evidence/w14/web-intelligence-evaluation.json` | `npm run intelligence:evaluate` | The evaluation suite |
