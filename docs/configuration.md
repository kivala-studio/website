# Configuration

No value of any variable is written in this repository. `.env.example` lists the names.

## Environment variables

Parsed in `src/config/env.ts`. `next.config.ts` calls `parseServerEnv`, so `next dev`, `next build` and `next start` fail with the name of every missing or invalid variable.

| Name | Required | Purpose and rules |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | Always | `demo`, `local` or `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | Unless `demo` | The Supabase project URL. Must be `https`, or `http` on `localhost`, `127.0.0.1`, `[::1]` or `*.localhost` |
| `NEXT_PUBLIC_SUPABASE_KEY` | Unless `demo` | The publishable key. A value containing `service_role` or starting with `sb_secret_` is rejected |
| `NEXT_PUBLIC_POSTHOG_TOKEN` | No | Enables browser telemetry and the maintenance flag |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Enables crash reports. Must be a valid URL under the same scheme rule |
| `SITE_URL` | Always | The public site's origin: metadata base, canonical URLs, sitemap, host split |
| `APP_URL` | No | The signed-in app's origin. Empty serves the app beside the site |
| `APPLE_WEBSITE_RECEIPT_SECRET` | No | Verifies the signed receipt of Apple account deletion. Without it, deletion of an Apple-linked account cannot start (`src/data/account/deletion.ts`) |
| `ANDROID_APP_PACKAGE` | No | Android application id for `/.well-known/assetlinks.json` |
| `ANDROID_APP_SHA256_FINGERPRINTS` | No | Comma-separated SHA-256 signing fingerprints (`AB:CD:…`) |

Server-only names (`SERVER_ONLY_ENV_NAMES`): `APPLE_WEBSITE_RECEIPT_SECRET`, `SITE_URL`, `APP_URL`, `ANDROID_APP_PACKAGE`, `ANDROID_APP_SHA256_FINGERPRINTS`. The bundle scan checks that none of these names reaches a client chunk.

Read outside `src/config/env.ts`:

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_VERCEL_ENV` | `src/data/intelligence/feature-config.ts` | Any value other than `production` makes the intelligence audience `internal` |
| `NODE_ENV` | `src/proxy.ts` | Development relaxations in the CSP |
| `INTELLIGENCE_EVALUATION_OUTPUT` | `src/domain/intelligence/evaluation/evaluation.test.ts` | Where the evaluation suite writes its export |
| `PLAYWRIGHT_BASE_URL` | `playwright.config.ts`, `playwright.local.config.ts` | Test a server that is already running |
| `CI` | `playwright.config.ts` | Reporter, `forbidOnly`, no server reuse |
| `CLIENT_DEV_PASSWORD`, `THROWAWAY_EMAIL`, `THROWAWAY_PASSWORD` | `tests/e2e-local` | Local-stack test accounts |

## Cookies

| Cookie | Set by | Attributes | Purpose |
|---|---|---|---|
| `sb-<ref>-auth-token` (chunked `.0`, `.1`, …) and other `sb-*` | Supabase SSR client | HttpOnly, SameSite=Lax, Secure on HTTPS, path `/`, parent domain when hosts are split | Session and PKCE verifier (`src/data/auth/cookies.ts`) |
| `investao-next` | `/auth/sign-in` | HttpOnly, path `/auth/callback`, 600 s | Post-sign-in path |
| `investao-apple-deletion` | `/api/account/apple-deletion/start` | HttpOnly, Secure, path `/api/account/apple-deletion`, 300 s | The deletion attempt |
| `theme` | `ThemeSwitch` in the browser | path `/`, one year, SameSite=Lax | `system`, `light` or `dark` |
| `investao-privacy` | Privacy mode in the browser | path `/`, one year, SameSite=Lax, Secure on HTTPS | `on` while personal values are hidden |
| Locale cookie | next-intl middleware | next-intl defaults | Not configured in this repository |

### Demo mode only

`demo-account` (`free`, `plus`, `pro`; absent means signed out), `demo-scenario` (`open`, `closed`, `stale`, `empty`, `partial`, `offline`, `listing`, `unverified`, `updates`; default `open`; also `?scenario=` on `/api/market/snapshot` and `/dev/market`), `demo-clock` (epoch milliseconds; moves the server clock for one browser), `demo-plans` (`closed` empties the plans), and the data cookies `demo-watchlist`, `demo-comparison-pair`, `demo-automatic`, `demo-groups`, `demo-rules`, `demo-sensitivity`, `demo-activity-read`, `demo-notification-preferences`, `demo-portfolio`, `demo-portfolio-scenario`, `demo-portfolio-books`, `demo-portfolio-cash`, `demo-portfolio-shares`, `demo-web-orders` (`src/data/demo/tiers.ts`, `src/data/demo/clock.ts`, `src/data/market/demo/scenarios.ts`, `src/data/demo/web-passes.ts`). Sign-out deletes the cookies in `DEMO_COOKIES`.

## Browser storage

| Key | Storage | Purpose | Cleared at sign-out |
|---|---|---|---|
| `investao.account.*` (including `investao.account.exposure.*`, `investao.account.personalisation.*`) | local and session | Account-scoped state | Yes |
| `investao.productVoice.<user id>.v1` | local | Product-voice receipts | Yes |
| IndexedDB database of the weekly reading (`INTELLIGENCE_DATABASE`, `src/data/intelligence/database.ts`) | IndexedDB | Readings and the local activity archive | Yes |
| `investao.accountSetup.<id>.*` | local | Account-setup draft | No, on purpose |
| `investao.simulation.draft.<id>` | session | Simulator draft | No |
| `investao.portfolio.selection` | — (`src/features/portfolio/selection.ts`) | Selected portfolio | No |
| `investao.bondTerms.<symbol>` | — (`src/features/market/instrument/bond-yield-dialog.tsx`) | Saved bond terms | No |
| `investao.alerts.deliveryNote` | — (`src/features/alerts/alerts-dialog.tsx`) | A dismissed note | No |
| `investao.learn.read` | local | Lessons opened | No |
| `investao.privacy.explained` | — (`src/features/privacy/privacy-mode.tsx`) | The privacy-mode explanation was shown | No |
| `investao.inviteCode` | session | A referral code from `/convite/[code]` | No |

"—" means the storage type was not checked for that key.

`clearAccountState` (`src/features/auth/account-state.ts`) removes only keys with the prefixes `investao.account.` and `investao.productVoice.`.

## Fixed public identifiers in code

| Value | Where |
|---|---|
| App Store URL of the iOS app, App Store subscriptions URL, support email | `src/features/site/site.ts` |
| PostHog hosts | `src/config/security.ts` |
| Share-link origin `https://invest.ao` | `src/features/portfolio/share-dialog.tsx` |
