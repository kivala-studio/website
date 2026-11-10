# invest.ao — Android and website rebuild plans

Written 2026-11-10 from two sources only: the backend (`investao-functions`, `origin/main` @ `8033581`) and the iOS app (`invest.ao`, `origin/main` @ `f4cf1e6`, version 1.1.5 build 18). Nothing in the old `investaoandroid/` or `website/` folders was read.

| File | What it is |
|---|---|
| [ANDROID_IMPLEMENTATION_PLAN.md](ANDROID_IMPLEMENTATION_PLAN.md) | Native Kotlin + Compose app, full parity with iOS 1.1.5, 18 app phases + 4 backend phases, one prompt per phase |
| [WEBSITE_IMPLEMENTATION_PLAN.md](WEBSITE_IMPLEMENTATION_PLAN.md) | Next.js full web app (marketing, public market pages, signed-in app), 19 web phases + 4 backend phases, one prompt per phase |
| [reference/backend-contract.md](reference/backend-contract.md) | Client contract of the backend: every table, RPC, Edge Function, limit, payload, and the gaps for Android and web |
| [reference/ios-product.md](reference/ios-product.md) | What the iOS app shows and does, screen by screen, plus design system, copy and formatting rules |
| [reference/ios-platform.md](reference/ios-platform.md) | What the iOS app does beneath the UI: backend call map, auth, caching, push, subscriptions, telemetry, logic to port |
| [fixtures/](fixtures/) | Golden files copied unchanged from iOS/backend, to be loaded by Android and web tests |

## How to run a phase

1. Delete the old `investaoandroid/` and `website/` folders. Each plan's phase 0 refuses to start if its target folder exists.
2. Create the read-only source checkouts once (the local backend checkout is on a feature branch and the iOS one is one commit behind, so the prompts never read them directly):

```bash
git -C invest.ao fetch origin && git -C invest.ao worktree add --detach ../.reference/ios origin/main
```

```bash
git -C investao-functions fetch origin && git -C investao-functions worktree add --detach ../.reference/backend origin/main
```

3. Open Claude Code in this folder (`invest.ao-app/`) for phase 0 of a plan, and in the new project folder for every later phase. Paste the phase's prompt. One phase = one branch = one pull request.
4. Backend phases (`B0`, `AB*`, `WB*`) run with Claude Code opened in `investao-functions/` and follow that repository's `AGENTS.md`.
5. A phase is finished only when every exit criterion in its section is ticked with evidence in the pull request.

To refresh the reference checkouts later: `git -C .reference/ios fetch origin && git -C .reference/ios checkout --detach origin/main` (same for `backend`). If iOS or the backend has moved, re-check the phase's "Source of truth" files before starting it.

## Decisions only you can make

Both plans proceed on the recommended option; change it before the phase named.

| # | Decision | Recommended | Needed before |
|---|---|---|---|
| 1 | Lift the backend rule "do not add … FCM assumptions" so Android can receive push | Yes, transport only (FCM HTTP v1 from Edge Functions; no Firebase database or auth) | AB1 |
| 2 | Android application id | `ao.invest.androidapp` (debug `ao.invest.androidapp.development`) | A0 |
| 3 | Google Play product ids and prices for Plus and Pro | Same four ids as iOS (`ao.invest.plus.monthly`, …) | AB2 |
| 4 | Sell subscriptions on the web | RevenueCat Web Billing (the backend already verifies through RevenueCat). If no, the web shows status and "manage in the store" only | WB2 / W16 |
| 5 | Public pages on the web show market data without sign-in (iOS shows nothing signed out) | Yes: market list, instrument page with daily history, news, lessons | W5 |
| 6 | Web hosting and the `invest.ao` domain cut-over | Vercel, cut over in W18 | W0 / W18 |
| 7 | Web Push | Build last (W17); the Activity centre is the notification channel until then | WB3 |
| 8 | Publish a terms page (iOS links Apple's standard EULA; there is none on invest.ao) | Yes, needed for web checkout and Play | W4 |

## Facts to confirm against the live project (phase 0 of either plan)

These live only in the hosted Supabase dashboard or in service-only tables, so they could not be read from the repositories:

- Auth: enabled providers, client ids, redirect allow-list, JWT expiry.
- `subscription_private.control`: is `enforcement_enabled` on, are referrals and gifts on.
- Role statement timeouts (last recorded: 3 s signed out, 8 s signed in).
- Realtime: the backend sends `market:prices` as a public topic, the iOS client joins it as private. Confirm which the project allows.
- Current `intelligence_feature_configuration` row and its expiry; `market_cache_private.client_control` values.
- Whether the platform adds CORS headers to Edge Functions (none are set in code).

## Things the sources disagree on

| Topic | Backend | iOS | Plans use |
|---|---|---|---|
| Trading hours | 09:25–15:00 (reviewed calendar) | 09:00–15:30 configured default | The server calendar only; no hard-coded hours |
| Realtime topic | public | private | Whatever phase 0 confirms; treat messages as refetch hints either way |
| Named portfolios limit | 9 named + main | "10" on the plans screen | 9 named + main, displayed as 10 |
| Daily-close push capability | `register-device` rejects `dailyCloseCapable` | — | Fixed in AB1 |
