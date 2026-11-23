# invest.ao website

One Next.js project that serves two things for invest.ao, a product for following Angola's stock market (BODIVA):

- the public site: landing page, public market pages, news, lessons, the Plus page, legal and support pages;
- the signed-in web app: home, watchlist, portfolio, activity, unusual activity, week ahead, simulator, plans and settings.

The backend is a Supabase project that lives in another repository. This repository holds no database code.

## Stack

Versions are the exact pins in `package.json`.

| Part | Version |
|---|---|
| Node.js | `>=22.12 <23` (`.nvmrc`: 22) |
| Next.js (App Router, Turbopack) | 16.4.6 |
| React, React DOM | 19.3.0 |
| TypeScript (strict) | 5.9.3 |
| Tailwind CSS (`@tailwindcss/turbopack`) | 4.3.3 |
| next-intl | 4.14.9 |
| `@supabase/supabase-js` | 2.118.0 |
| `@supabase/ssr` | 0.12.7 |
| decimal.js | 10.6.0 |
| pdfjs-dist | 6.4.299 |
| tesseract.js, tesseract.js-core | 7.0.0 |
| Vitest | 5.1.0 |
| Playwright (`@playwright/test`) | 1.64.1 |
| `@axe-core/playwright` | 4.14.0 |
| ESLint, eslint-config-next | 9.39.5, 16.4.6 |

## Repository layout

| Path | Contents |
|---|---|
| `src/app` | Routes: pages under `[locale]`, route handlers under `api`, `auth`, `og`, `.well-known` |
| `src/proxy.ts` | The Next.js proxy: CSP nonce, session refresh, host split, sign-in redirect, locale routing |
| `src/config` | Environment parsing, host split, security headers and CSP |
| `src/domain` | Pure TypeScript business logic. ESLint forbids React, Next.js, Supabase and other layers here |
| `src/data` | Supabase clients, reads and writes, caches, demo data, telemetry |
| `src/features` | Feature UI, stores, server actions |
| `src/ui` | Design system: components, icons, motion, theme tokens |
| `src/i18n` | next-intl routing, message scoping, the app's `Link` |
| `messages` | `pt.json`, `en.json`, `key-map.json` |
| `design/icon-pack` | Icon masters (`masters.json`) |
| `scripts` | Message conversion, icon generation, statement assets, client bundle scan |
| `tests` | `e2e` (demo mode), `e2e-local` (local Supabase stack), `fixtures` |
| `docs` | Documentation (`docs/README.md` is the index) and `docs/plan` (implementation plans) |

## Setup

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_DATA_MODE=demo and SITE_URL=http://localhost:3000
npm ci
npm run dev
```

`demo` mode needs no backend. The build and the dev server stop with the name of every missing or invalid variable (`next.config.ts`, `src/config/env.ts`).

## Environment variables

Names only. Purposes and rules are in [docs/configuration.md](docs/configuration.md).

`NEXT_PUBLIC_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SITE_URL`, `APP_URL`, `APPLE_WEBSITE_RECEIPT_SECRET`, `ANDROID_APP_PACKAGE`, `ANDROID_APP_SHA256_FINGERPRINTS`.

## Commands

| Command | What it runs |
|---|---|
| `npm run dev` | `scripts/statement-assets.mjs`, then `next dev` |
| `npm run build` | `scripts/statement-assets.mjs`, `next build`, then `scripts/scan-client-bundle.mjs` |
| `npm run start` | `next start` |
| `npm run lint` | `eslint --max-warnings=0` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | `vitest run` |
| `npm run check` | lint, typecheck, test |
| `npm run scan:bundle` | The client bundle scan alone |
| `npm run e2e` | Playwright against a production build in `demo` mode (`playwright.config.ts`) |
| `npm run e2e:local` | Playwright against a `local` build and a local Supabase stack (`playwright.local.config.ts`) |
| `npm run lhci` | Lighthouse CI with the budgets in `lighthouserc.json` |
| `npm run messages` | Regenerates `messages/*.json` from the iOS string catalogue |
| `npm run icons` | Regenerates `src/ui/icons/icon-pack.ts` from `design/icon-pack/masters.json` |
| `npm run intelligence:evaluate` | Runs the intelligence evaluation suite and writes its export to `docs/evidence/w14/web-intelligence-evaluation.json` |

## Hosts

With `APP_URL` set, the site and the app are served on two hosts and the proxy keeps each page on its host. Without it, one host serves both. Details: [docs/architecture.md](docs/architecture.md).

To try the split locally: `SITE_URL=http://invest.localhost:3000 APP_URL=http://dashboard.invest.localhost:3000`.

## Deployment

The repository contains no deployment configuration. What it does prove is in [docs/deployment.md](docs/deployment.md).

## Documentation

[docs/README.md](docs/README.md) is the index. Working rules for agents are in [AGENTS.md](AGENTS.md).
