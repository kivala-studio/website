# AGENTS.md

invest.ao website: Next.js App Router, TypeScript strict, Tailwind. Plan: `docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md`. References: `docs/reference/`. Golden fixtures: `tests/fixtures/` (unchanged copies; never edit).

Commands: `npm run check` (lint, typecheck, unit tests), `npm run build` (build + client bundle scan), `npm run e2e` (Playwright, demo mode), `npm run lhci` (Lighthouse budgets), `npm run messages` (regenerate `messages/*.json` from the iOS catalogue), `npm run icons` (regenerate the icon pack). Design gallery: `/dev/design` (not in production builds). Copy `.env.example` to `.env.local` for development.

The sections below are copied word for word from the plan (sections 1.2 to 1.5).

### 1.2 Routes

Portuguese slugs for both languages; English lives under `/en/…`.

| Area | Route | Notes |
|---|---|---|
| Marketing | `/` | Landing page, store links |
| Legal and help | `/policy`, `/termos`, `/suporte` | **`/policy` is linked from the iOS app and must keep that exact path** |
| Public market | `/mercado`, `/mercado/[symbol]` | One instrument page for everyone; signed-in visitors get more on the same URL |
| Public content | `/noticias`, `/noticias/[slug]`, `/aprender`, `/aprender/[lesson]` | |
| Shared portfolio | `/partilha/[token]` | **Linked from iOS Pro share links; exact path** |
| Referral | `/convite/[code]` | Landing that carries a referral code to sign-in or the stores |
| Account entry | `/entrar`, `/auth/callback`, `/eliminar-conta` | `/eliminar-conta` is the public deletion URL the stores ask for |
| Signed-in | `/inicio`, `/lista`, `/carteira`, `/carteira/posicao/[symbol]`, `/atividade`, `/atividade-invulgar`, `/semana`, `/simulador`, `/wrap/[period]`, `/planos`, `/definicoes` | Require a session; unknown visitors go to `/entrar?next=…` |
| Server endpoints | `/api/market/snapshot`, `/api/billing/sync`, `/api/account/apple-deletion/start`, `/api/account/apple-deletion/complete` | **The `complete` path is the one the backend docs name as the web return URL** |
| Well-known | `/.well-known/assetlinks.json` | Android App Links; `apple-app-site-association` when iOS adds universal links |

### 1.3 Standing rules (phase W0 writes these into the new repo's `AGENTS.md`)

1. **Sources, in order of authority:** live backend behaviour → `docs/reference/backend-contract.md` → iOS code in `../.reference/ios` → iOS docs → `docs/reference/ios-*.md`. Where iOS docs and code disagree, code wins. Never read or copy from any earlier website or Android project.
2. **Prices.** A price is shown as current only with valid, unexpired evidence (`data_quality.status = valid`, no reasons, Luanda trading date = today, now < `validUntilEpoch`, calendar unexpired). Otherwise show the dated verified close or `Preço por confirmar`. Never zero, never a stale number as current, never "live" or "tempo real".
3. **Cached HTML never contains a current price.** Server-rendered and statically cached pages show the dated verified close; the current quote is added in the browser after its own validity check.
4. **Market state** comes from the server calendar evaluated in `Africa/Luanda`. No hard-coded trading hours, no browser time zone.
5. **Numbers.** `Decimal` for every ledger, cash, threshold and valuation value; civil dates as date strings. No JavaScript `number` arithmetic in portfolio or simulator maths.
6. **Edge Functions are called only from the server** (route handlers), never from the browser. PostgREST, Auth and Realtime may be called from the browser with the publishable key.
7. **Secrets** (`service_role`, receipt secret, RevenueCat secret) never reach the browser bundle and are never committed. Only `NEXT_PUBLIC_*` values are public, and only the project URL, the publishable key and public tokens may use that prefix.
8. **Limits are the server's.** Tier limits arrive as PostgREST errors (`P0001` + message). Features are open unless `get_subscription_access().enforcement_enabled` is true.
9. **No automatic request retries.** Only the market poll loop retries, with full-jitter backoff and `retry_after_seconds`. Polling pauses while the tab is hidden; current quotes are revoked when the tab is hidden or offline. Re-check the signed-in user id after every await before applying a result.
10. **Privacy.** Telemetry is cookieless, allow-listed and never identified; it reports route templates, not concrete paths. Share tokens, account data and amounts never appear in analytics, logs, referrers or cached responses.
11. **Copy.** Angolan Portuguese addressing the user as "tu", sentence case; reuse iOS wording verbatim from the message catalogue; cut taglines, helper text and secondary labels.
12. **Design.** Financial values are the hero. Do not turn every section into a card. Gain/loss colour applies to changes only. Light and dark are first-class. Every control is reachable by keyboard with a visible focus ring; targets ≥ 44 px; layouts hold at 200 % zoom and 320 px width.
13. **Backend changes are never worked around.** If a phase needs something the backend lacks, stop and report.
14. **Git.** One task branch per phase, Conventional Commits, push, open a PR to `main` with the verification performed. No mention of AI tooling in commits, code or docs.
15. **Tests are proportional.** Golden fixtures and contract tests for logic; one flow or screenshot for UI.

### 1.4 Run modes and test data

| Mode (`NEXT_PUBLIC_DATA_MODE`) | Backend | Use |
|---|---|---|
| `demo` | None. Repositories return recorded fixtures from `tests/fixtures/`; scenario chosen by a cookie or `?scenario=` in non-production builds | Playwright flows and screenshots, offline development |
| `local` | Local Supabase stack (`http://127.0.0.1:54321`) seeded by backend phase B0, with a development-only password sign-in for B0's accounts | Integration of auth, writes and limits |
| `production` | Hosted project | Deployed site and owner smoke tests only. No automated test targets it |

Demo mode cookies: `demo-scenario` picks the market (`open`, `closed`, `stale`, `empty`, `partial`, `offline`, `listing`; default `open`); `demo-account` signs in a demo account (`free`, `plus`, `pro`) whose watchlist and comparison pair live in cookies. Without `demo-account` the app is signed out.

A single public `GET /functions/v1/market-snapshot` may be recorded once into fixtures; nothing else touches production from a test.

### 1.5 Definition of done for every phase

- All tasks in the phase section meet their "Done when".
- `npm run check` (ESLint, `tsc --noEmit`, Vitest) and `npm run build` pass; `npm run e2e` passes in `demo` mode.
- New UI verified at 375, 768 and 1440 px, light and dark, `pt` and `en`, keyboard only, and at 200 % zoom; Playwright axe scan of each new page has no serious or critical issue.
- Exit criteria ticked in the PR description, each with evidence (test name, screenshot, command output, preview URL).
- No user-visible string outside the message catalogue, no `number` in money paths, no secret in the client bundle (checked by the bundle scan from W0), no new dependency without a line of justification.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
