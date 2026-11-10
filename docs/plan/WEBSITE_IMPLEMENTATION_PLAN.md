# invest.ao website — implementation plan

Target: one web product at `https://invest.ao` built from an empty folder — the marketing site, public market pages, and the signed-in app at parity with iOS 1.1.5 wherever a browser allows.
Sources of truth: the live backend contract and the iOS app. See [README.md](README.md) for setup, owner decisions and open facts.

## 1. Ground rules

### 1.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, latest stable), React, TypeScript `strict` | Server rendering for public and SEO pages, route handlers as a thin server for secrets |
| Styling | Tailwind CSS with the invest.ao tokens as CSS variables (light, dark, increased contrast) | One token source, theme switch without re-render |
| Backend SDK | `@supabase/supabase-js` + `@supabase/ssr` (cookie sessions, PKCE) | Server and browser share one session |
| Client data | TanStack Query for account data; one market store (external store + `useSyncExternalStore`) | Same single-owner model as iOS `MarketStore` |
| Money / time | `decimal.js` (38 significant digits), civil dates as `YYYY-MM-DD` strings, all clocks evaluated in `Africa/Luanda` | Ledger is `numeric(24,8)`; trading days are Luanda dates |
| Formatting | Own formatters (not `Intl` output) with table tests | Guarantees `pt_AO` parity with iOS on every browser |
| i18n | `next-intl`; `pt` default without prefix, `en` under `/en` | |
| Charts | Own SVG chart on `d3-scale` / `d3-shape` | iOS chart rules are specific |
| Telemetry | PostHog web without cookies or identification, Sentry (own project) | Same allow-list as iOS with `platform: "web"` |
| Billing | RevenueCat Web Billing (`@revenuecat/purchases-js`) | Owner decision 4; backend verifies through RevenueCat |
| Tests | Vitest (domain, data, components), Playwright (flows, screenshots, axe), Lighthouse CI budgets | Proportional: golden fixtures over mirrored tests |
| Hosting | Vercel, preview deployment per pull request | Owner decision 6 |

Source layout: `src/domain` (pure TypeScript — no React, Next or Supabase imports, enforced by an ESLint boundary rule), `src/data`, `src/ui` (design system), `src/features`, `src/app` (routes).

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

A single public `GET /functions/v1/market-snapshot` may be recorded once into fixtures; nothing else touches production from a test.

### 1.5 Definition of done for every phase

- All tasks in the phase section meet their "Done when".
- `npm run check` (ESLint, `tsc --noEmit`, Vitest) and `npm run build` pass; `npm run e2e` passes in `demo` mode.
- New UI verified at 375, 768 and 1440 px, light and dark, `pt` and `en`, keyboard only, and at 200 % zoom; Playwright axe scan of each new page has no serious or critical issue.
- Exit criteria ticked in the PR description, each with evidence (test name, screenshot, command output, preview URL).
- No user-visible string outside the message catalogue, no `number` in money paths, no secret in the client bundle (checked by the bundle scan from W0), no new dependency without a line of justification.

### 1.6 Phase map

| Milestone | Phases | Outcome |
|---|---|---|
| Backend enablement | B0, WB1, WB2, WB3 | Seeded local stack; web sign-in, deletion, payments and push accepted by the backend |
| M1 — Public site | W0–W5 | Replaces the current site: landing, legal, public market, news, lessons, shared portfolio page. Can go live on `invest.ao` at the end of W5 |
| M2 — Signed-in core | W6–W10 | Sign in, Home, instrument extras, watchlist, alerts, Activity centre, settings, account deletion |
| M3 — Portfolio | W11–W12 | Manual ledger with full parity |
| M4 — Insight | W13–W15 | Content screens, intelligence, Weekly Wrap |
| M5 — Launch | W16–W18 | Subscriptions, Web Push, final audit |

Dependencies: W1 and W2 need W0. W3 needs W2. W4 needs W1. W5 needs W1–W3. W6 needs W3 + WB1. W7–W10 need W6. W11 needs W6 (calculator already in W2). W12 needs W11. W13 needs W7. W14 needs W8 + W11. W15 needs W14. W16 needs W8 + WB2. W17 needs W9 + WB3. W18 needs everything.

---

## 2. Backend phases (run in `investao-functions/`)

### B0 — Client development seed

Shared with the Android plan; the full section and prompt are in [ANDROID_IMPLEMENTATION_PLAN.md](ANDROID_IMPLEMENTATION_PLAN.md) under "B0". Run it once. The website needs it from W3 onward.

### WB1 — Web sign-in and web account deletion (configuration)

**Goal.** A browser can sign in with Google or Apple into the same account as iOS, and an Apple-linked account can be deleted from the website.

| # | Task | Done when |
|---|---|---|
| 1 | Owner checklist in `docs/web-auth.md`: site URL and redirect allow-list (`https://invest.ao/auth/callback`, the preview-deployment pattern, `http://localhost:3000/auth/callback`); Google web client; Apple Services ID listed first in the Apple provider's client ids and its return URLs | Each item names where it is set and how to confirm it |
| 2 | `supabase/config.toml`: local `site_url` and `additional_redirect_urls` gain the localhost callback | `supabase start` accepts the web redirect |
| 3 | Web deletion configuration documented by name: `APPLE_WEBSITE_RETURN_URL = https://invest.ao/api/account/apple-deletion/complete`, `APPLE_WEBSITE_RECEIPT_SECRET` (32-byte hex shared with the website server) | `apple-web-deletion/start` with `returnPlatform: "web"` returns 200 locally instead of `APPLE_WEBSITE_UNAVAILABLE` |
| 4 | A test vector for the receipt (payload, secret, expected token) added to `tests/` and copied to `docs/web-auth.md` | The website can verify its implementation against it |

**How to test.** `deno task test:unit` and `test:edge`. Locally: call `/start` for a B0 user given an Apple identity, post a stubbed Apple form to `/callback`, confirm the 303 carries a `receipt` that verifies with the documented algorithm.

**Exit criteria**
- [ ] Receipt test vector verified by an independent script (not the function's own code).
- [ ] An account created on iOS signs in on the web and sees the same watchlist (owner smoke test recorded).

**Prompt**

```text
Phase WB1 — web sign-in and web account deletion (invest.ao backend).

Read AGENTS.md, docs/apple-account-deletion.md, supabase/config.toml, supabase/functions/_shared/{apple_web_deletion.ts,apple_deletion_receipt.ts}, tests/apple_web_deletion_test.ts, and ../plans/reference/backend-contract.md sections 1 and 12.1.

Implement section "WB1" of ../plans/WEBSITE_IMPLEMENTATION_PLAN.md. Most of it is a precise owner checklist, local config, and a receipt test vector. Do not change hosted settings yourself and do not invent client ids or secrets — use named placeholders.

Constraints: no behaviour change for iOS. The website never calls Edge Functions from the browser, so do not add CORS headers in this phase.

Verify with "How to test". Finish per AGENTS.md: task branch, Conventional Commit, push, PR to main.
```

### WB2 — Web payments

**Goal.** A subscription bought on the website grants the same Plus/Pro entitlement. Needs owner decision 4; skip the phase if the answer is no.

| # | Task | Done when |
|---|---|---|
| 1 | `_shared/subscriptions.ts` accepts the web store value(s) RevenueCat reports for Web Billing and the web product ids, mapped to tiers | `tests/subscriptions_test.ts`: a web `plus` and a web `pro` subscriber fixture yield the right tier; unknown stores still fail |
| 2 | `docs/subscriptions.md`: web products, entitlement mapping, test mode ↔ sandbox, cross-store behaviour, customer-portal link | A reader can configure the web offering from the doc alone |
| 3 | Owner checklist (payment account, RevenueCat web app, products and 7-day trial, webhook unchanged) | Each item verifiable |

**How to test.** `deno task test:unit`; locally stub the RevenueCat fetch with the web fixture, call `sync-subscription`, then `get_subscription_access()`.

**Exit criteria**
- [ ] App Store (and Play, if AB2 is merged) fixtures give unchanged results.
- [ ] Web fixture → `is_plus` / `is_pro` as expected.

**Prompt**

```text
Phase WB2 — web payments (invest.ao backend).

Read AGENTS.md, docs/subscriptions.md, supabase/functions/_shared/subscriptions.ts, tests/subscriptions_test.ts, and ../plans/reference/backend-contract.md sections 7 and 12.2.

Implement section "WB2" of ../plans/WEBSITE_IMPLEMENTATION_PLAN.md. Confirm from RevenueCat's current documentation which `store` values a Web Billing subscriber reports before writing the allow-list, and cite the page in the PR.

Constraints: no migration; entitlement semantics unchanged; nothing the client sends may grant access.

Verify with "How to test". Finish per AGENTS.md.
```

### WB3 — Web Push

**Goal.** Browsers can subscribe to the same notifications, with the same privacy rules. Needs owner decision 7.

| # | Task | Done when |
|---|---|---|
| 1 | Storage for browser subscriptions (`endpoint`, `p256dh`, `auth`) with owner RLS and service-only read, counted in the 20-device limit; reuse the `platform = 'web'` value if AB1 is merged, otherwise add it | pgTAP covers ownership, limit and uniqueness |
| 2 | `register-web-push` / unregister Edge Function: user JWT, validates the endpoint host against known push services, `notificationLanguage` | Deno tests for happy path, bad endpoint, wrong user |
| 3 | `_shared/web_push.ts`: VAPID-signed, `aes128gcm` encrypted delivery; 404/410 disable the subscription; secrets by name (`WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`) | Unit tests decrypt a produced message with a test key pair |
| 4 | Transport branch in the account pipeline and explicit alerts; payload = routing keys of contract §10.4 + server-rendered `title`/`body`; generic text for private categories; no background-refresh messages for web | A queued `portfolio_daily` for a web subscription carries only generic copy |
| 5 | Audience mapping for web rows in the feature-config gate | Gate tests pass |

**How to test.** `deno task test`. Locally: register a subscription created by a headless browser, trigger an alert rule, capture and decrypt the push.

**Exit criteria**
- [ ] iOS (and Android) notification tests unchanged and green.
- [ ] Decrypted payload matches the documented shape for alert rule, asset movement and news.

**Prompt**

```text
Phase WB3 — Web Push (invest.ao backend).

Read AGENTS.md, docs/NOTIFICATIONS.md, docs/notification-platform.md, supabase/functions/_shared/{apns.ts,account_notifications.ts}, and ../plans/reference/backend-contract.md sections 4.6, 10.4 and 10.7. If backend phase AB1 is merged, read its migration and fcm.ts first and follow the same platform branching.

Implement section "WB3" of ../plans/WEBSITE_IMPLEMENTATION_PLAN.md.

Constraints: existing platforms unchanged. Lock-screen privacy rules identical. Never log endpoints or keys. Forward-only migration. The registration function is called by the website's server, so it needs no CORS.

Verify with "How to test". Finish per AGENTS.md.
```

---

## 3. Web phases

Every prompt below is run with Claude Code opened in the new website folder (W0 is the exception). Paths: iOS source `../.reference/ios`, backend source `../.reference/backend`, plan `docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md`, references `docs/reference/`.

### W0 — Foundation

**Goal.** An empty, deployable, verifiable project with rules, references, CI and a preview deployment.

| # | Task | Done when |
|---|---|---|
| 1 | Create the project in a new folder `website/` (abort if it exists), `git init`, Next.js + TypeScript strict + Tailwind, source layout of §1.1 with the ESLint boundary rule for `src/domain` | `npm run build` succeeds from a clean clone |
| 2 | Environment handling: `.env.example` with names only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_DATA_MODE`, `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_REVENUECAT_WEB_KEY`, `APPLE_WEBSITE_RECEIPT_SECRET`, `SITE_URL`); typed, validated at boot | Missing required variables fail the build with the variable's name |
| 3 | `AGENTS.md` with §1.2–§1.5 verbatim; `docs/plan/` and `docs/reference/` copied from `../plans`; fixtures copied to `tests/fixtures/` unchanged | Checksums equal the sources |
| 4 | Scripts: `check` (lint, typecheck, Vitest), `e2e` (Playwright against `demo`), `build`; a bundle scan that fails if a server-only variable name or the string `service_role` appears in client chunks | The scan fails on a deliberately leaked value (demonstrated, then reverted) |
| 5 | Security baseline: headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, frame denial, Permissions-Policy) and a Content-Security-Policy with nonces, allowing only the Supabase project, PostHog and Sentry hosts | Playwright asserts the headers on `/` |
| 6 | CI: `check`, `build`, `e2e`, Lighthouse CI with budgets (LCP ≤ 2.5 s, CLS ≤ 0.1, total blocking time ≤ 200 ms on the mobile profile) | Workflow runs on every PR |
| 7 | Hosting project and preview deployments; favicon and app icons from the iOS master (`Design/AppIcon/invest-ao-master.svg`) | A PR gets a preview URL (or, if hosting access is missing, an exact owner checklist) |
| 8 | Confirm the open facts in `../plans/README.md` that can be read without privileged access; record in `docs/reference/live-facts.md` | Each fact marked confirmed (with how) or "owner to confirm" |

**How to test.** Clean clone → `npm ci && npm run check && npm run build && npm run e2e`. Open the preview: placeholder page with correct icon and headers.

**Exit criteria**
- [ ] §1.5 commands pass on CI.
- [ ] No file from any previous website project exists in the repo history.
- [ ] Bundle scan and header assertions are part of CI.

**Prompt**

```text
Phase W0 — foundation for the new invest.ao website.

You are in the workspace root (invest.ao-app/). Read plans/README.md and plans/WEBSITE_IMPLEMENTATION_PLAN.md sections 1 and "W0".

Preconditions — stop and tell me if any fails: the folder website/ does not exist; .reference/ios and .reference/backend exist (README "How to run a phase" step 2). Do not open, list or search any other website or Android project anywhere on disk.

Create website/ as a new git repository and implement every task in section W0. Use current stable versions of Next.js, React, Tailwind and the other libraries, pin them, and list them in the PR description.

Constraints: no feature code beyond a placeholder page. No secret values in the repo — names only. AGENTS.md must contain plan sections 1.2 to 1.5 word for word. Do not connect a domain.

Verify with "How to test". Commit with Conventional Commits. If a remote exists push and open a PR; otherwise leave the branch committed and say so.
```

### W1 — Design system, formatting, localisation

**Goal.** Tokens, components, formatters and messages that already match iOS.

**Source of truth.** `docs/reference/ios-product.md` §3 and §4; iOS `Core/DesignSystem`, `Core/Components`, `Core/Formatting`, `Resources/Localizable.xcstrings`, `Tools/IconPack/masters.json`.

| # | Task | Done when |
|---|---|---|
| 1 | Colour tokens as CSS variables: the 21 light/dark pairs and increased-contrast values (`prefers-contrast: more`); theme by `data-theme` with System / Light / Dark, no flash on load | A test asserts each variable's value in light and dark against a table transcribed from `SemanticColors.swift` |
| 2 | Type roles (44/34/22/20/17/15/12/11 px as rem) with tabular figures; spacing 4–40; radii 12/18/24/pill | Gallery shows each role; digits do not shift width |
| 3 | Icon sprite generated from the 56 iOS masters by a committed script | 56 symbols; none replaced by a third-party icon set |
| 4 | Components (product §3.9) as accessible React components: buttons, action tile, asset row, feature row, card, section header, page heading, tabs, segmented control, time-range picker, search field, financial value, change badge, market metric, status indicator, logo with monogram fallback, loading/empty/error states, skeletons, section placeholder, toast host, offline banner, sensitive value, amount field, dialog and sheet (side panel on desktop, bottom sheet on mobile) | Each has a story on a non-production `/dev/design` page; all operable by keyboard |
| 5 | Formatters in `src/domain/format`: number, AOA currency, signed percent, tiny-percent bands, percentage points, bond % of par, quantity, compact axis, counts, dates, timestamps with `· Luanda`, periods, relative day — `pt_AO` and `en_AO`, implemented without relying on the browser's locale data | Table tests reproduce every example of §4.3 and the cases of iOS `FinancialPresentationTests` and `CivilDatePresentationTests`, identical in Chromium, Firefox and WebKit |
| 6 | Amount input: decimal comma, `.` becomes `,`, live grouping, 2–8 fraction digits, caret preserved | Tests port `AmountInputFormattingTests`, `LiveAmountEditingTests` |
| 7 | Messages: a committed script converts `Localizable.xcstrings` to `messages/pt.json` and `messages/en.json` (dotted keys kept, sentence keys renamed with a recorded mapping, `%@`/`%lld` → named ICU arguments, plurals kept) | Deterministic; a test checks every key exists in both languages with matching arguments |
| 8 | Motion per §3.6 with `prefers-reduced-motion` fallbacks | Presence, press, numeric change and toast transitions exist and honour the preference |
| 9 | Playwright screenshot baseline of `/dev/design`: light/dark × 375/1440 px | Baseline committed and verified in CI |

**How to test.** `npm run check`. Screenshot run. Manual: tab through the gallery (visible focus on every control), toggle theme, zoom to 200 %, use a screen reader on the asset row and change badge ("Subiu/Desceu …").

**Exit criteria**
- [ ] Formatter tests cover every row of §4.3 in both locales and pass in three browser engines.
- [ ] No component uses a literal colour, size or string.
- [ ] `/dev/design` is excluded from production builds and from the sitemap.
- [ ] axe scan of the gallery: no serious or critical issue.

**Prompt**

```text
Phase W1 — design system, formatting, localisation (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W1", and docs/reference/ios-product.md sections 3 and 4.
iOS source to translate (read-only): ../.reference/ios/Invest.AO/Core/DesignSystem, Core/Components, Core/Formatting, Resources/Localizable.xcstrings, Tools/IconPack, and tests FinancialPresentationTests, AmountInputFormattingTests, LiveAmountEditingTests, CivilDatePresentationTests, LocalizationTests under Tests/MarketDiscoveryTests.

Implement every task of W1. Token values come from the Swift code, not the iOS docs (the docs' hexes are stale). Translate behaviour for the web: sheets become dialogs or side panels on desktop, pull-to-refresh becomes an explicit refresh control, haptics are dropped.

Constraints: formatters live in src/domain with no React or Intl-locale dependence. Port the iOS test cases as tables. The message converter and the icon generator are committed scripts.

Verify: npm run check, the screenshot run, and the manual checks in "How to test". Tick the exit criteria in the PR with evidence. Finish per AGENTS.md.
```

### W2 — Domain core

**Goal.** The pure rules: models, decoding, calendar, quote policy, classification, discovery, time ranges, error mapping, and the ledger calculator (needed early for the shared-portfolio page).

**Source of truth.** Contract §2–3, §5.1, §9.1, §13; platform §3.1, §6, §10, §12.1, §12.6; iOS `Core/Market/Domain/**`, `Features/Portfolio/Data/PortfolioCalculator.swift` and their tests.

| # | Task | Done when |
|---|---|---|
| 1 | Models and tolerant decoding (zod or hand-written guards) for securities, quotes with `DataQuality`, sessions, overview, availability, reference prices, closes, pulse, calendar v2, client control; numbers into `Decimal` | `tests/fixtures/home-compact-contract.json` decodes with expected values (ports `HomeCompactContractTests`, `TolerantMarketDecodingTests`) |
| 2 | Market calendar and status in `Africa/Luanda`, expiry rules | Ports `MarketCalendarTests`; results identical with the process time zone set to `America/New_York` and `Asia/Tokyo` |
| 3 | Current-quote policy, revocation triggers (including tab hidden and offline), local downgrade deadline, display precedence and labels | Ports `CurrentQuotePolicyTests`, `DataQualityTests`, `VerifiedClosingPricesTests`, `MarketReferencePriceTests`, `MarketQuoteDateTests` |
| 4 | Security classification, visibility, bond price semantics | Ports `SecurityKindClassificationTests` |
| 5 | Discovery: filters, accent-insensitive search (`ação`/`acção`), sorts with missing values last, movers | Ports `MarketDiscoveryTests`, `GlobalSearchLogicTests`, `MarketDisplayMovementTests` |
| 6 | Time ranges and availability | Ports the `TimeRange` cases |
| 7 | Refresh policy (30/60/120 s, server floor, maintenance, backoff, `retry_after_seconds`, pause when hidden) | Ports `MarketRefreshBackoffTests` with an injected clock |
| 8 | Error taxonomy and mapping, `P0001` messages → typed limits | Ports `AppErrorTests`, `SupabaseErrorBoundaryTests` |
| 9 | Ledger calculator (weighted average cost, fees, income, bond scale, oversell invalidates, results by year, allocations, value series) | `tests/fixtures/portfolio-ledger.v1.json` passes unchanged — all 8 golden cases, decimals compared as strings |

**How to test.** `npm run check` (Vitest). All tests inject the clock; none sleeps.

**Exit criteria**
- [ ] Each iOS test file named above has a TypeScript counterpart with the same cases (listed with counts in the PR).
- [ ] `src/domain` imports nothing from React, Next or Supabase (boundary rule green).
- [ ] No `number` arithmetic on prices, thresholds or ledger values (lint rule or documented grep in CI).

**Prompt**

```text
Phase W2 — domain core (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W2", docs/reference/backend-contract.md sections 2, 3, 5.1, 9.1 and 13, and docs/reference/ios-platform.md sections 3.1, 6, 10, 12.1 and 12.6.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Market/Domain, Core/Errors, Features/Portfolio/Data/PortfolioCalculator.swift, and the test files named in section W2 under Tests/MarketDiscoveryTests.

Implement every task of W2 in src/domain as pure TypeScript. Port the listed iOS tests case for case — they are the specification. Make the ledger golden fixture pass unchanged.

Constraints: clock and zone injected; market zone is Africa/Luanda whatever the runtime zone. decimal.js for all money and percentages. Trading hours never hard-coded. Where the contract and iOS disagree, follow the contract and note it in the PR.

Verify: npm run check, including a run with TZ=America/New_York and TZ=Asia/Tokyo. List each ported test file with its case count and tick the exit criteria. Finish per AGENTS.md.
```

### W3 — Data layer and market store

**Goal.** One well-behaved source of market state for server-rendered pages and the browser.

**Source of truth.** Contract §3, §8, §9.1, §13; platform §3.0–3.1, §5, §6, §9; iOS `Core/Networking`, `Core/Market`, `Core/Telemetry`, `Core/FeatureFlags`.

| # | Task | Done when |
|---|---|---|
| 1 | Supabase clients: server (cookies), browser, and an anonymous server client for public pages | A `local`-mode page reads `securities` from the local stack |
| 2 | `GET /api/market/snapshot`: fetches the Edge Function server-side, forwards `ETag` / `If-None-Match` / `Cache-Control`, returns 304s, passes `Retry-After`; cached at the edge for the upstream max-age | Vitest with a mocked upstream ports iOS `MarketSnapshotRouteTests`; a second request within max-age does not hit the upstream |
| 3 | Fallback reads (`securities`, `get_current_market_quotes`, `latest_verified_market_closes`) on contract/4xx failure and for 5 minutes after a 5xx/timeout; never both routes in one refresh | Test asserts request counts |
| 4 | Browser market store: single owner, applies quote policy, polls per W2 policy, pauses when `document.hidden`, revokes current quotes on hidden/offline/failure, downgrades on a timer at `validUntilEpoch`, forced refresh | Tests with fake timers port `QuoteRecoveryTests`, `MarketConnectivityMonitorTests` |
| 5 | Realtime: join `market:prices` while visible; on `quotes` wait 0–10 s jitter then refresh unless the `etag` is already held; polling remains as watchdog | Ports `QuoteAnnouncementTests` |
| 6 | Server data helpers for public pages: catalogue, verified closes, daily history (≤ 1 year when signed out), pulse history, issuers, dividends, reports, news — each with explicit revalidation and no current prices | A unit test proves the public instrument payload contains no field derived from a current quote |
| 7 | Global error presenter (one toast, de-duplicated, grouped retry), offline banner wiring | Ports `ErrorRecoveryTests` |
| 8 | Maintenance: PostHog flag `web-maintenance` (+ `-development`), 300 s refresh, 3600 s cache, fail-open; snapshot `control.maintenance` slows polling only | Ports the maintenance cases of `AppUpdatePolicyTests`; a maintenance page exists |
| 9 | Telemetry: PostHog with in-memory persistence (no cookies, no local storage), never identified, allow-list sanitiser with `platform: "web"`, page views reported as route templates; error limiter; Sentry with PII off | Ports `TelemetryPrivacyTests`; a test proves `/partilha/abc…` is reported as `/partilha/[token]` |
| 10 | Demo fixtures: record one production snapshot, derive scenarios `open`, `closed`, `stale`, `empty`, `partial`, `offline` | `demo` mode serves any scenario |

**How to test.** `npm run check`. Manual in `local` mode: quotes appear while the seeded market is open; switch tab for 3 minutes and return → prices show `Preço por confirmar` until the refresh lands; go offline in dev tools → banner and revoked quotes.

**Exit criteria**
- [ ] The browser never requests `/functions/v1/*` (Playwright network assertion).
- [ ] No automatic retry outside the poll loop (request-count test).
- [ ] Hidden-tab and offline behaviour recorded with screenshots.
- [ ] Telemetry tests prove no user id, token, instrument id or amount can be sent.

**Prompt**

```text
Phase W3 — data layer and market store (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W3", docs/reference/backend-contract.md sections 3, 8, 9.1 and 13, docs/reference/ios-platform.md sections 3.0, 3.1, 5, 6 and 9, and docs/reference/live-facts.md.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Networking, Core/Market (Data, Store), Core/Telemetry, Core/FeatureFlags, plus the test files named in section W3.

Implement every task of W3. Realtime channel visibility is whatever live-facts.md records; if unconfirmed, join as the iOS client does and keep the choice in one constant.

Constraints: Edge Functions only from route handlers. One market store per browser tab. Never render prices from the Realtime payload. Public server helpers must not return current prices, because their output is cached. Record the production snapshot fixture with a single public GET.

Verify: npm run check and the manual checks in "How to test" against the local stack from backend phase B0. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W4 — Marketing, legal, SEO

**Goal.** The public face of invest.ao and every URL the apps and stores depend on.

**Source of truth.** Product §4.1 (voice, disclaimers), §9 (store listing copy), §2.14 (introduction pages), platform §11.2; brand kit skill `invest-ao-brand` if available in the session.

| # | Task | Done when |
|---|---|---|
| 1 | Landing `/`: what the product is, the three introduction themes (market, watchlist, portfolio), product screenshots, App Store link (`https://apps.apple.com/app/id6812907673`), Play badge once the Android app exists, sign-in entry | Copy derived from the iOS store listing; no claim of real-time data, advice, bank sync or trading |
| 2 | `/policy` (privacy policy with a working support contact), `/termos`, `/suporte` | `/policy` returns 200 at exactly that path in both languages; content is supplied or approved by the owner, not invented |
| 3 | `/eliminar-conta`: explains in-app deletion on iOS and Android and offers web deletion (sign in → W10 flow); works as the stores' deletion URL | Reachable signed out; links into `/entrar?next=/definicoes` |
| 4 | `/convite/[code]`: validates the code format (8 chars from `A-HJ-NP-Z2-9`), shows the offer, stores the code for after sign-in, links to the stores | Invalid format → 404; code is not sent to analytics |
| 5 | Site chrome: header, footer with the standing disclaimers, language switch, theme switch | Disclaimers verbatim from product §4.1 |
| 6 | SEO: metadata and Open Graph per page, generated OG images, `sitemap.xml`, `robots.txt`, canonical and `hreflang` (pt/en), `Organization` structured data | Lighthouse SEO ≥ 95 on `/`; sitemap lists only public, indexable routes |
| 7 | `/.well-known/assetlinks.json` (package and fingerprints from env, empty-safe) | Valid JSON with the correct content type |
| 8 | 404 and error pages in the design system | Styled and translated |

**How to test.** Playwright: every route returns 200 in `pt` and `en`, headers present, axe clean. Lighthouse CI on `/` and `/policy` (mobile). Manual read-through of the copy against product §4.1.

**Exit criteria**
- [ ] `/policy` and `/eliminar-conta` are live on the preview at their exact paths.
- [ ] Legal text is owner-approved (recorded in the PR) — placeholders are not shipped.
- [ ] Lighthouse: performance ≥ 90, accessibility ≥ 95, SEO ≥ 95 on the landing page (mobile profile).
- [ ] No tracking cookie is set on any page (Playwright cookie assertion).

**Prompt**

```text
Phase W4 — marketing, legal, SEO (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W4", and docs/reference/ios-product.md sections 2.14, 4.1, 8 and 9, and docs/reference/ios-platform.md section 11.2.
iOS references (read-only): ../.reference/ios/fastlane/metadata/pt-PT, docs/app-store-aso.md, docs/product-copy.md, docs/onboarding-introduction.md, Design/AppStoreCreativeAssets.

Implement every task of W4. Before writing legal pages, ask me for the privacy policy, terms and support contact text; if I have not supplied them, build the pages with clearly marked draft content and leave the exit criterion unticked.

Constraints: Portuguese first, English second. The store listing spells "acção"; in-product copy spells "ação" — follow the in-product spelling on the site except when quoting the store. One call to action per section; no stacked promotional cards; no helper taglines.

Verify: npm run check, npm run e2e, Lighthouse on the preview. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W5 — Public market, news, lessons, shared portfolio

**Goal.** Anyone can browse the market and read content; iOS share links resolve. End of milestone M1.

**Source of truth.** Product §2.2, §2.6, §2.7 (public parts), §2.11, §2.12, §2.C1.15; contract §3, §5.4; iOS `Features/Markets`, `Features/AssetDetails`, `Features/News`, `Features/Learn`.

| # | Task | Done when |
|---|---|---|
| 1 | Chart component (SVG): line + 10 % area, linear, direction colour, right-hand axis with compact labels, pinned endpoints, pointer and keyboard scrubbing to the nearest real observation, shimmer loading, in-place empty/failed, text summary for assistive tech | Ports `ChartScrubbingTests`; arrow keys move between observations |
| 2 | `/mercado`: category filter, sort key and direction, search, result count, session data disclosure; sortable table on desktop, rows on mobile; master–detail at ≥ 1024 px; both empty states | Sorting/filtering use W2 logic; matured bonds hidden; URL reflects filter and sort |
| 3 | `/mercado/[symbol]` public layer, server-rendered: identity, dated verified close and label, daily chart with ranges up to `1A`, statistics from history, issuer, dividends, financial reports, bond facts, sources; current quote added client-side when valid | With JavaScript disabled the page shows the verified close with its date and no "current" price |
| 4 | Market overview block on `/mercado`: Indicador invest.ao with the "not an official BODIVA index" label, methodology dialog with the legal text, session totals, movers top 3 | Legal text verbatim |
| 5 | `/noticias` (paging, search) and `/noticias/[slug]` (Markdown subset with safe URLs, sources, related instruments, `Article` structured data, OG image) | Ports `NewsFeedTests`, `NewsMarkdownTests`; a `javascript:` link in a fixture is not rendered |
| 6 | `/aprender` and `/aprender/[lesson]`: the seven lessons | Content equals the iOS bundle |
| 7 | `/partilha/[token]`: validates `^[A-Za-z0-9_-]{32}$`, calls `get_shared_portfolio` server-side with `no-store`, computes positions with the W2 calculator and current public prices client-side, read-only, clear "not found or revoked" state | `noindex`, `Referrer-Policy: no-referrer`, absent from sitemap and analytics paths; a revoked token shows the not-found state |
| 8 | Structured data and indexing for instrument and article pages; instrument pages in the sitemap | Rich-results test passes for an article |
| 9 | M1 release gate: redirect map from any existing live URLs supplied by the owner, final check of `/policy` and `/partilha/*` on the preview | Checklist in `docs/release/m1.md` |

**How to test.** `npm run check`. Playwright in `demo`: filter and sort the market, open an instrument, scrub the chart with the keyboard, open an article, open a share link (valid and revoked). In `local` mode: create a share as `pro@…` with the service helper from B0 and open it signed out. Lighthouse on `/mercado/[symbol]`.

**Exit criteria**
- [ ] View-source of an instrument page contains no current price, only the dated close.
- [ ] Signed-out pages make no request for intraday data or history older than one year.
- [ ] The share token appears in no log line, analytics event, referrer or cache key (evidence listed).
- [ ] Lighthouse on the instrument page: performance ≥ 90, accessibility ≥ 95 (mobile).

**Prompt**

```text
Phase W5 — public market, news, lessons, shared portfolio (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W5", docs/reference/ios-product.md sections 2.2, 2.6, 2.7, 2.11, 2.12, 2.C1.15 and 3.8, and docs/reference/backend-contract.md sections 3 and 5.4.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Markets, Features/AssetDetails, Features/News, Features/Learn, Core/Charts, Features/Portfolio/Data/PortfolioShares.swift, and tests ChartScrubbingTests, NewsFeedTests, NewsMarkdownTests, MarketInformationTests.

Implement every task of W5. Showing market data without sign-in is a deliberate difference from iOS (owner decision 5); everything else follows iOS rules. The instrument page is one URL for everyone — build it so phase W7 can add signed-in panels without a second page.

Constraints: server-rendered output is cached, so it may contain only dated verified closes and history. Treat the share token as a bearer secret end to end. Articles stay in their authored language. No advice or forecast wording.

Verify: npm run check, npm run e2e, the local-stack share check, Lighthouse. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W6 — Authentication, onboarding, app shell

**Goal.** Sign in on the web into the same account as iOS and land in a responsive shell. Needs WB1.

**Source of truth.** Product §1, §2.15–2.16; platform §4; contract §1, §12.1; iOS `Features/Authentication`, `Features/Onboarding`.

| # | Task | Done when |
|---|---|---|
| 1 | `/entrar`: Google and Apple buttons (OAuth with PKCE through Supabase), the line `Não liga a tua conta bancária ou de corretagem.`, error and cancel states | Both providers complete on a preview deployment listed in the redirect allow-list |
| 2 | `/auth/callback` route handler exchanging the code for a cookie session; `next` parameter validated as a same-origin path | An absolute or protocol-relative `next` is ignored (test) |
| 3 | Session middleware refreshing cookies; signed-in route group redirects visitors to `/entrar?next=…`; session expiry leads to one re-auth transition | Playwright: deep link to `/carteira` signed out → sign in → lands on `/carteira` |
| 4 | Development-only password sign-in for B0 accounts in `local` mode | Absent from the production bundle (bundle scan) |
| 5 | Account setup after first sign-in: optional name, first-watchlist picker with search and category chips, resumable draft | Ports `PostLoginOnboardingTests`; reload mid-setup resumes |
| 6 | Shell: sidebar on desktop, bottom bar on mobile, with Início · Explorar (`/mercado`) · Carteira · Lista · search; header with profile initials, unusual-activity icon, bell with unread state | Keyboard users can reach every destination; current page announced |
| 7 | Sign-out: server clears cookies; browser clears query cache, market account state and local stores | After sign-out the back button shows no account data (no-store on signed-in pages) |
| 8 | Pending referral code from `/convite/[code]` survives sign-in | Offered for redemption in W16; stored without analytics |
| 9 | Signed-in pages send `Cache-Control: private, no-store` | Asserted in Playwright |

**How to test.** Vitest for the `next` validator and setup draft. Playwright in `local` mode with the password sign-in: sign in as `free@…`, reload (restored), sign out, protected-route redirect and return. Owner smoke on a preview with real Google and Apple accounts.

**Exit criteria**
- [ ] An account created on iOS shows the same watchlist after web sign-in (owner check recorded).
- [ ] Open-redirect test on `next` passes.
- [ ] Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] No account data is served from any shared cache.

**Prompt**

```text
Phase W6 — authentication, onboarding, app shell (invest.ao website).

Precondition: backend phase WB1's owner checklist is done for the environment you test against. If not, stop.

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W6", docs/reference/ios-product.md sections 1 and 2.15–2.16, docs/reference/ios-platform.md section 4, and docs/reference/backend-contract.md sections 1 and 12.1.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Authentication, Features/Onboarding, App/ApplicationShell.swift, and tests AuthenticationStoreTests, SessionRestorationTests, PostLoginOnboardingTests.

Implement every task of W6 with @supabase/ssr cookie sessions.

Constraints: email sign-up does not exist in the product; the password sign-in is local-mode only and must not ship. Validate every redirect target. Signed-in pages are never cached. Use the iOS copy from the message catalogue.

Verify: npm run check, npm run e2e, the local-mode Playwright flow, and an owner smoke test on the preview. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W7 — Signed-in Home, search, instrument extras

**Goal.** The signed-in market experience: the Home dashboard and everything on the instrument page that needs an account.

**Source of truth.** Product §2.1, §2.3, §2.7; contract §3.6, §3.7, §7.3; iOS `Features/Home`, `Features/Search`, `Features/AssetDetails`.

| # | Task | Done when |
|---|---|---|
| 1 | `/inicio` sections in order: market overview, watchlist rail (≤ 6, empty call-to-action), context slot (real empty state until W14), movement feed (top 3 on mobile, more allowed on desktop), news (≤ 3), market updates (≤ 3), recap menu (until W15), simulator entry; two-column layout on desktop | Demo scenarios `open`, `closed`, `partial`, `empty` match product §2.1 states |
| 2 | Market session panel: indicator value, change, chart with ranges (`1D` disabled with zero trades, `Tudo` gated), metrics, no-index variant, methodology dialog | Range gating follows W2 |
| 3 | Home states: skeleton, failure with retry, refresh-failure toast with content kept, offline banner, explicit refresh control | Each reachable in `demo` |
| 4 | Search: command palette (`/` or `Ctrl/⌘ K`) and a mobile search page — category cards with counts, recents (≤ 8, local storage, clearable), highest volume (6), results grouped by kind with a star toggle | Fully keyboard operable; recents persist |
| 5 | Instrument page, signed-in panels: intraday via `get_intraday_chart` (all statuses), `Tudo` history (Plus), order book 5 levels / full (Pro) refreshing every 60 s while visible, liquidity (Plus), follow star, alert button states, share (Web Share or copy link), history CSV export (Plus) | Ports `IntradayMovementTests`, `OrderBookLevelTests`, `AssetDetailsLogicTests`; CSV bytes equal the iOS exporter's for the same input |
| 6 | Bond yield calculator dialog | Ports `BondYieldTests` to the last digit |
| 7 | Comparison: up to 3 instruments as % change from a common start, `authorize_chart_comparison` with Free limits and the "allowance not used" message, download as PNG | Ports `ChartComparisonMathTests` |
| 8 | Pre-admission listing view from `market_events` | Demo scenario `listing` |
| 9 | Typed limit reasons surfaced in a neutral dialog until W16 supplies the plans page | Verified in `local` mode with enforcement on |

**How to test.** `npm run check`. Playwright screenshots of `/inicio` in four scenarios × light/dark × 375/1440. `local` mode: as `free@…` (enforcement on) `Tudo`, CSV export and a third comparison instrument are refused with the right reason; as `pro@…` the book shows more than five levels.

**Exit criteria**
- [ ] `/inicio` never shows a price for an instrument without a usable quote in the `stale` scenario.
- [ ] Bond prices render as % of par with p.p. changes.
- [ ] Yield, comparison and CSV outputs match iOS vectors.
- [ ] The whole flow search → instrument → follow works with the keyboard only.

**Prompt**

```text
Phase W7 — signed-in Home, search, instrument extras (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W7", docs/reference/ios-product.md sections 2.1, 2.3 and 2.7, and docs/reference/backend-contract.md sections 3.6, 3.7 and 7.3.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Home, Features/Search, Features/AssetDetails, Core/Market/Domain/Models/BondYield.swift, Core/Market/Domain/LiquidityProfile.swift, Core/Charts/ChartComparisonMath.swift, and tests BondYieldTests, LiquidityProfileTests, ChartComparisonMathTests, AssetDetailsLogicTests, OrderBookLevelTests, IntradayMovementTests.

Implement every task of W7. Extend the single instrument page from W5; do not create a second one. Write the product §2.7 section checklist into the PR and tick it.

Constraints: one card on Home (the overview). The comparison quota is the server's — call authorize_chart_comparison and map its errors. Short history series must render without error. Order-book refresh stops when the panel or tab is hidden.

Verify: npm run check, npm run e2e, screenshots, and the local-mode tier checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W8 — Watchlist and alerts

**Goal.** Follow, organise, and set rules.

**Source of truth.** Product §2.9, §2.C2; contract §4.1–4.3, §4.5, §7.4; iOS `Features/Watchlist`, `Features/Alerts`.

| # | Task | Done when |
|---|---|---|
| 1 | `/lista`: states of §2.C2.1, rows with price and change, explicit refresh | All states reachable in `demo` |
| 2 | Add dialog with search; remove with undo; drag-and-drop reorder with a keyboard alternative (move up/down) through `reorder_watchlist` (reload on "membership changed") | Ports `WatchlistLogicTests`, `WatchlistStoreTests`, `WatchlistUndoTests` |
| 3 | Row menu (replaces swipe): alerts, movement toggle, remove | Reachable by keyboard and pointer |
| 4 | Groups (Plus): create, rename, delete, members, filter; `PLUS_REQUIRED`, `WATCHLIST_GROUP_LIMIT` mapped | Verified in `local` mode |
| 5 | Free-plan selection: choose 3 active + 1 movement instrument (`select_free_watchlist`); others show `Pausado` | Server's `active_watchlist_ids` drive the UI |
| 6 | Alerts panel per instrument: list, pause, delete; editor for the eight rule kinds with threshold validation (`high_52w`/`low_52w` = 1, volume multiple 1.5–20, inactivity days 1–365) | Ports `MarketAlertsStoreTests`, `MarketAlertsLoadRaceTests` |
| 7 | Automatic movement alerts per instrument and sensitivity Low/Normal/High | `FREE_MOVEMENT_LIMIT` mapped |
| 8 | Writes idempotent (client ids, ignore duplicates), optimistic with rollback and one toast | A repeated save after a simulated timeout creates one row |
| 9 | A note where alerts are created: delivery is in the mobile apps and the Activity centre until Web Push (W17) | Shown once, dismissible, removed by W17 when push is enabled |

**How to test.** `npm run check`. Playwright in `demo`: add, reorder by keyboard, remove, undo. `local` mode with enforcement on: as `free@…` hit the 4th instrument, 3rd rule, 2nd movement instrument and group creation; as `plus@…` create a group and three rules.

**Exit criteria**
- [ ] All eight rule kinds can be created, paused, edited and deleted against the local stack.
- [ ] Each server limit maps to its own reason.
- [ ] Reorder is possible without a pointer.
- [ ] A rule created on the web appears in the iOS app (owner cross-check).

**Prompt**

```text
Phase W8 — watchlist and alerts (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W8", docs/reference/ios-product.md sections 2.9 and 2.C2, and docs/reference/backend-contract.md sections 4.1, 4.2, 4.3, 4.5 and 7.4.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Watchlist, Features/Alerts, Core/Market/Domain/Policies/WatchlistOrdering.swift, and tests WatchlistLogicTests, WatchlistStoreTests, WatchlistUndoTests, MarketAlertsStoreTests, MarketAlertsLoadRaceTests.

Implement every task of W8. Limits come from server errors; map each P0001 message and details.feature to a typed reason for W16.

Constraints: direct table writes under RLS exactly as the contract allows; update only permitted columns. Client-generated UUIDs. Watchlist insights are W14 — leave the slot.

Verify: npm run check, npm run e2e, and the local-mode limit checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W9 — Activity centre and notification preferences

**Goal.** The inbox is the web's notification channel; preferences are shared with the apps.

**Source of truth.** Product §2.13, §7.5; contract §4.4, §4.5; iOS `Features/Notifications`, `Core/Intelligence/ActivityPolicy.swift`.

| # | Task | Done when |
|---|---|---|
| 1 | `/atividade`: inbox from `get_account_notifications` (keyset paging) merged with explicit-alert deliveries (de-duplicated per rule and quote), filters, grouping, read state via `acknowledge_account_notifications` | Ports `ActivityCenterTests`, `NotificationFactTests`, `DailyCloseCopyTests` |
| 2 | Row rendering from the server composition (`title`, `body`, `accessibilityText`); typed routing by category (wrap, portfolio insight, unusual digest, article, instrument, none) | Every category of contract §4.4 opens its destination or deliberately does nothing |
| 3 | Bell unread state re-evaluated every 60 s while visible; a toast for new items that arrive while the page is open | Reading everything clears the bell |
| 4 | Notification settings: watched movements, held-asset movements, portfolio daily, listings, public previews, daily close (default off), market recap (RPC), unusual-activity master + seven rules, sensitivity; the line `Até cinco avisos opcionais por dia. Entre as 20h e as 8h, o radar fica em silêncio.` | Each toggle round-trips to its table/RPC on the local stack |
| 5 | Privacy-mode masking hook for titles and messages that may hold personal content | Hook in place for W10 |

**How to test.** `npm run check`. `local` mode: as `plus@…`, seeded notifications list, paging loads older rows, opening one marks it opened, toggles persist after reload.

**Exit criteria**
- [ ] Inbox paging uses the keyset (both `created_at` and `id`) and never an offset.
- [ ] Preferences changed on the web are visible in the iOS app (owner cross-check).
- [ ] Rows older than the server's 28 days are not requested or shown.

**Prompt**

```text
Phase W9 — Activity centre and notification preferences (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W9", docs/reference/ios-product.md sections 2.13 and 7.5, and docs/reference/backend-contract.md sections 4.4 and 4.5.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Notifications, Core/Intelligence/ActivityPolicy.swift, ActivityArchive.swift, and tests ActivityCenterTests, NotificationFactTests, NotificationDeliveryMappingTests, DailyCloseCopyTests.

Implement every task of W9. Render server compositions only; local voice composition belongs to W14.

Constraints: there is no per-user Realtime channel — refetch on an interval while visible. Never show a threshold or amount in a toast. Web Push is phase W17; do not request notification permission here.

Verify: npm run check, npm run e2e, and the local-mode checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W10 — Settings, privacy mode, account deletion

**Goal.** The account can be managed and deleted from the website — also the stores' deletion URL. End of milestone M2.

**Source of truth.** Product §2.17, §5.1; platform §4.4–4.5; contract §1.5, §4.7; iOS `Features/Profile`, `Features/Settings`, `Core/Privacy`.

| # | Task | Done when |
|---|---|---|
| 1 | `/definicoes`: profile (display name; tolerate a missing `user_profiles` row), appearance (System/Light/Dark), language (pt/en), notifications (W9), data source and disclaimer, links to policy and terms, personalisation reset controls (filled by W14), sign out | Row list in the PR matches product §2.17 minus iOS-only rows, each noted |
| 2 | Privacy mode: per-browser preference, off by default, survives sign-out; eye toggle with first-use explanation; masking per the §5.1 table across alerts, Activity centre and (later) portfolio; holdings sorted by id while hidden | Ports `PrivacyModeTests`; screen readers announce `Valor oculto` |
| 3 | Deletion for non-Apple accounts: confirmation, `delete_user_account`, then full local and cookie clean-up; copy states store subscriptions are not cancelled | A local-stack user is gone from `auth.users` |
| 4 | Deletion for Apple-linked accounts: `POST /api/account/apple-deletion/start` creates a 64-hex challenge, stores challenge + user id in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (5 min), calls the Edge Function with `returnPlatform: "web"`, redirects to Apple | Cookie attributes asserted in a test |
| 5 | `GET /api/account/apple-deletion/complete`: verifies the receipt (HMAC-SHA256 over `investao.apple-deletion.v1.` + data, audience, version, expiry) and that challenge and user id equal the cookie; clears the session only on `deleted` and after confirming with the server; shows `deleted` / `cancelled` / `failed` | Passes the WB1 test vector; rejects a tampered signature, wrong audience, expired receipt, mismatched challenge, replay |
| 6 | `/eliminar-conta` (W4) now leads straight into this flow | Signed-out visitor → sign in → deletion screen |
| 7 | Route handlers reject cross-origin requests (Origin check) and non-POST starts | Tests cover both |

**How to test.** Vitest for receipt verification (vector + five rejections). Playwright in `local` mode: delete a throwaway user through the non-Apple path; run the Apple path against the stubbed Apple endpoint for all three outcomes.

**Exit criteria**
- [ ] Receipt verification uses a constant-time comparison and the secret exists only on the server (bundle scan).
- [ ] `cancelled` and `failed` keep the user signed in with a clear message.
- [ ] After `deleted`, no cookie or local storage entry for the account remains (listed).
- [ ] M2 smoke on the preview: sign in → follow → create an alert → see it in the Activity centre after a seeded trigger → delete the account.

**Prompt**

```text
Phase W10 — settings, privacy mode, account deletion (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W10", docs/reference/ios-product.md sections 2.17 and 5.1, docs/reference/ios-platform.md sections 4.4 and 4.5, and docs/reference/backend-contract.md section 1.5 (path C and the receipt format are binding).
Backend source (read-only): ../.reference/backend/docs/apple-account-deletion.md, supabase/functions/_shared/apple_deletion_receipt.ts, and docs/web-auth.md if backend phase WB1 has added it (it holds the receipt test vector).
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Settings, Features/Profile, Core/Privacy, docs/privacy-mode.md, docs/account-deletion.md, and tests AccountDeletionStoreTests, PrivacyModeTests.

Implement every task of W10.

Constraints: an Apple-linked account must never call delete_user_account. The receipt secret is server-only. Verify signature, audience, version, expiry, challenge and user id — fail closed on any mismatch. Clear the session only after the server confirms the user is gone.

Verify: npm run check, npm run e2e, the local-mode deletion runs, then the M2 smoke. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W11 — Portfolio core

**Goal.** The manual ledger on the web with the same maths.

**Source of truth.** Product §2.C1.1–2.C1.7, §2.C1.12, §2.C1.16; platform §12.1; contract §5.1; iOS `Features/Portfolio`.

| # | Task | Done when |
|---|---|---|
| 1 | Ledger repository: `get_portfolio_ledger_page` (500-row keyset, revision, `PT409` → restart), direct writes with client ids and civil dates | Ports `PortfolioLedgerContractTests`, `PortfolioIdempotentSaveTests`, `PortfolioCivilDateTests`, `PortfolioRefreshTests` |
| 2 | `/carteira` dashboard in the §2.C1.3 order: value, period change, value chart with ranges, positions, allocation, summary; `Valor parcial` / `Valor indisponível`; two-column desktop layout | Demo scenarios `full`, `partial`, `empty`, `invalid ledger` |
| 3 | Records table, position page (average cost, realised/unrealised), transaction editor for buy/sell/income with server validations mirrored and server errors mapped | Each rule in contract §5.1's table has an inline message |
| 4 | CSV export (`invest-ao-carteira.csv`) and import with review, same format as iOS | Ports `PortfolioCSVTests`; a file exported by iOS imports unchanged |
| 5 | Privacy mode across the portfolio per §5.1; unitless trend chart; holdings sorted by id when hidden | Screenshots hidden vs shown |
| 6 | Reload every 60 s while visible; valuation only from current quotes | In `stale` the dashboard shows `Valor indisponível`, never a value from a closing reference |

**How to test.** `npm run check`. Playwright screenshots of dashboard states × privacy. `local` mode as `plus@…`: add a buy, an overselling sell (refused), income, edit, delete; export, wipe, import.

**Exit criteria**
- [ ] Dashboard totals equal the W2 calculator's output for the seeded ledger (asserted in a test, decimals as strings).
- [ ] No `number` arithmetic under the portfolio feature (lint/grep).
- [ ] Export → import round trip reproduces the ledger exactly.
- [ ] A transaction recorded on the web shows on iOS with identical average cost (owner cross-check).

**Prompt**

```text
Phase W11 — portfolio core (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W11", docs/reference/ios-product.md sections 2.C1.1–2.C1.7, 2.C1.12 and 2.C1.16, docs/reference/ios-platform.md section 12.1, and docs/reference/backend-contract.md section 5.1.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Portfolio (Data and the dashboard, records, position, editor and transfer views), and tests PortfolioCalculatorTests, PortfolioLedgerContractTests, PortfolioCSVTests, PortfolioCivilDateTests, PortfolioIdempotentSaveTests, PortfolioRefreshTests.

Implement every task of W11 on top of the calculator from W2.

Constraints: decimal.js everywhere; trade dates are Luanda civil dates no later than today there. A closing reference never values a position. Named portfolios, cash, benchmark, income calendar, statement reader and share-link management are W12.

Verify: npm run check, npm run e2e, screenshots, and the local-mode ledger checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W12 — Portfolio, advanced

**Goal.** The Plus and Pro portfolio features.

**Source of truth.** Product §2.C1.8–2.C1.11, §2.C1.13, §2.C1.15, §2.C1.17; contract §5.2–5.4; platform §12.1.

| # | Task | Done when |
|---|---|---|
| 1 | Named portfolios: switcher, create/rename/delete with cascade warning, per-portfolio calculation; `PLUS_REQUIRED`, `PORTFOLIO_LIMIT` | Verified in `local` mode |
| 2 | Cash movements, balance and total result | Unit tests reproduce the iOS cash cases |
| 3 | Benchmark against inflation and rates (`market_rates`) with continuous compounding | Unit tests reproduce the iOS benchmark cases |
| 4 | Results by year; yearly report downloaded as a PDF generated in the browser | Totals equal the calculator's |
| 5 | Income calendar; totals (Plus). Payment-day reminders: offered only once Web Push exists (W17); until then the control explains that reminders are in the mobile apps | No dead control |
| 6 | Statement reader (Plus): file upload (image or PDF), text extracted in the browser, parsed with the port of `StatementTextParser`, review screen feeding the import flow | Parser tests port the iOS cases; the file never leaves the browser (network assertion) |
| 7 | Share links (Pro): create (token shown once with copy button), list with explicit columns, revoke; URL `https://invest.ao/partilha/{token}`; `PRO_REQUIRED`, `SHARE_LIMIT` | A created link opens the W5 page; revoke turns it into not-found |
| 8 | Gating summary of §2.C1.17 through typed limit reasons | Matrix in the PR, one row per gate |

**How to test.** `npm run check`. `local` mode with enforcement on across the three seed accounts for every gate. PDF opens in a viewer.

**Exit criteria**
- [ ] Every gate in §2.C1.17 behaves correctly for free, plus and pro.
- [ ] Cash and benchmark maths match iOS vectors.
- [ ] The share token is shown once and never stored in browser storage, logs or analytics.
- [ ] Statement files are processed locally only.

**Prompt**

```text
Phase W12 — portfolio, advanced (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W12", docs/reference/ios-product.md sections 2.C1.8–2.C1.11, 2.C1.13, 2.C1.15 and 2.C1.17, docs/reference/ios-platform.md section 12.1, and docs/reference/backend-contract.md sections 5.2, 5.3 and 5.4.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Portfolio/Data (PortfolioCash, PortfolioBooks, PortfolioBenchmark, PortfolioResults, IncomeCalendar, StatementTextParser, PortfolioShares, PortfolioYearReport) with their views and tests.

Implement every task of W12. Maths in src/domain with the iOS vectors ported.

Constraints: request portfolio_shares with explicit columns (select=* fails). Share tokens are bearer secrets. Text extraction runs in the browser only; load the recognition library lazily so it does not weigh on other pages.

Verify: npm run check, npm run e2e, and the local-mode gate matrix. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W13 — Content: unusual activity, week ahead, simulator, market information

**Goal.** The remaining reading and exploring surfaces.

**Source of truth.** Product §2.4, §2.5, §2.8, §2.11 (market information); contract §3.10; platform §12.2.

| # | Task | Done when |
|---|---|---|
| 1 | `/atividade-invulgar`: grouped by instrument, watchlist section first, shares before bonds, signal lines per rule with the wording table, withdrawn orders struck through, disclaimer, notification controls | Ports `UnusualActivityTests`; all nine rules render |
| 2 | `/semana`: next Monday–Friday in Luanda, day sections, event rows with status and source, relationship badges, saved-batch banner, about section, three states | Ports `WeekAheadTests` |
| 3 | `/simulador`: projection chart, controls and presets, methodology and disclaimers, generic and instrument modes, draft kept locally | Ports `InvestmentSimulationTests`, `AssetInvestmentSimulationTests`, `SimulationDraftTests` with identical outputs |
| 4 | Market information page with category chips and update detail; Home market-updates slot wired | Ports `MarketInformationTests` |

**How to test.** `npm run check`. Screenshots of each page in content/empty/error. Compare the simulator's final balance for the iOS presets with the iOS vectors.

**Exit criteria**
- [ ] Simulator outputs equal iOS vectors to the last displayed digit.
- [ ] Both disclaimers verbatim.
- [ ] Week ahead shows nothing when the calendar is unverified.

**Prompt**

```text
Phase W13 — content screens (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W13", docs/reference/ios-product.md sections 2.4, 2.5, 2.8 and 2.11, docs/reference/ios-platform.md section 12.2, and docs/reference/backend-contract.md section 3.10.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/UnusualActivity, Features/WeekAhead, Features/Simulation, Features/News (MarketInformationView, MarketUpdateDetailView), Core/Intelligence/WeekAheadPolicy.swift, docs/investment-simulator.md, docs/week-ahead-phase7.md, and the tests named in section W13.

Implement every task of W13. The simulator's monthly growth factor follows the documented formula (log1p/expm1 in double precision, converted through the shortest decimal string) so results match iOS.

Constraints: no forecast or advice wording. Simulator maths in src/domain with decimal.js at 38 significant digits.

Verify: npm run check, npm run e2e, screenshots. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W14 — Intelligence, personalisation, product voice

**Goal.** Insights on Watchlist, Portfolio, Home and the Activity centre, computed in the browser for the signed-in user.

**Source of truth.** Product §2.1 (context slot, Discover), §2.C1.14, §2.C2.9, §2.C3, §5.2; platform §9.5–9.6, §12.3–12.5; contract §3.12, §4.8, §4.9; fixtures `parity.v1.json`, `catalogue.v1.json`, `intelligence-feature-config.example.json`.

| # | Task | Done when |
|---|---|---|
| 1 | Feature controls: decode the configuration, FNV-1a bucket, audiences (`production` on the live site, `internal` elsewhere), dependencies, expiry → optional features off | Fixture `fixture-install\|weekly_wrap\|phase19` → 8065; ports `IntelligenceFeatureControlTests` |
| 2 | Evidence and validation (`get_market_period_evidence`, freshness policy, series and portfolio validators) | Ports `InsightFoundationTests` |
| 3 | Generators: 5 watchlist and 9 portfolio insight types | Ports `WatchlistIntelligenceTests`, `PortfolioIntelligenceTests` |
| 4 | Product voice: catalogue byte-identical (checksum test), deterministic composition, English via messages, recent-choice memory | `parity.v1.json` passes unchanged; ports `ProductVoiceTests` |
| 5 | Personalisation: activity events → daily counters synced via `user_activity_daily`, interest profile, ranking v1/v2/significance, exposure receipts (56 days), feedback; reset controls in Settings | Ports `PersonalisationTests`, `PersonalizationEngineTests` |
| 6 | Cache per user in IndexedDB with invalidation on ledger/watchlist/market fingerprint change, 7-day expiry (24 h week ahead), "saved" labels; cleared on sign-out | Ports `IntelligenceCacheTests` |
| 7 | Surfaces: watchlist weekly reading with dismiss / not useful; portfolio weekly reading tiles with explanation panels; Activity centre merge; Home context slot resolver and Saturday Discover | Ports `HomeContextResolverTests`, `SaturdayDiscoverTests` |
| 8 | Privacy classes enforced; nothing from the engine reaches analytics | Ports `IntelligencePrivacyTests` |
| 9 | Evaluation export comparable with iOS `intelligence-evaluation.json` | Diff against the iOS export for shared scenarios is empty (attached) |

**How to test.** `npm run check` is the gate. `demo` mode with the clock set to Friday after close, Saturday and Sunday: the context slot shows the Wrap card, Discover (≤ 5 rows, caps respected) and the Week-ahead offer; privacy mode removes personal rows.

**Exit criteria**
- [ ] `parity.v1.json` and the catalogue checksum pass.
- [ ] Evaluation diff against iOS is empty for shared scenarios.
- [ ] No personal amount or holding quantity appears on `/inicio` in any scenario.
- [ ] The engine's code is loaded only on signed-in routes (bundle analysis attached).

**Prompt**

```text
Phase W14 — intelligence, personalisation, product voice (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W14", docs/reference/ios-product.md sections 2.1 (context slot rules, Saturday Discover), 2.C1.14, 2.C2.9, 2.C3 and 5.2, docs/reference/ios-platform.md sections 9.5, 9.6 and 12.3–12.5, and docs/reference/backend-contract.md sections 3.12, 4.8 and 4.9.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Intelligence (all files), Core/Personalisation, Core/ProductVoice, Core/Privacy/IntelligencePrivacy.swift, docs/intelligence-foundation.md, docs/portfolio-insight-catalog.md, docs/watchlist-insight-catalog.md, docs/PERSONALIZATION_DECISIONS.md, every test file named in section W14, and scripts/compare-intelligence-evaluations.py.

This is a port, not a redesign: translate file by file into src/domain, porting each test file first. The reference documents describe this area by architecture only — the Swift source and its tests are the specification, including every weight, threshold and tie-break. If the Android port exists (../investaoandroid/domain), you may compare results with it but do not copy its code.

Constraints: computed in the browser for the signed-in user; re-check the user id after every await. Evidence only from get_market_period_evidence and only is_final rows. The catalogue file is copied, never edited. Privacy mode zeroes interest scoring and hides personal and private classes.

Verify: npm run check; produce the evaluation export and diff it against an iOS export (run `swift test --filter IntelligenceEvaluationTests` in ../.reference/ios if a macOS toolchain is available; otherwise say so and attach the web export). Then the context-slot checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W15 — Weekly Wrap

**Goal.** The weekly review as a web story player.

**Source of truth.** Product §2.10; contract §3.8, §4.9; iOS `Features/WeeklyWrap`.

| # | Task | Done when |
|---|---|---|
| 1 | Availability (`get_available_market_wraps`), entry points (Home context card, recap menu, Activity centre, `/wrap/weekly-YYYY-MM-DD` validated as a Luanda Monday), expired → `Wrap indisponível` | Ports `WrapAvailabilityRepositoryTests` |
| 2 | Assembly from `get_weekly_wrap_evidence` — the eleven story kinds, personalised order | Ports `VerifiedWeeklyWrapTests`, `WeeklyWrapTests` |
| 3 | Player: always dark, full-viewport on mobile and a centred stage on desktop; click/tap zones, arrow keys, space to pause, Escape to close; progress segments; resume and completion; longer timing at large text; reduced-motion fallbacks | Playwright steps through every story with the keyboard |
| 4 | Soundtrack off by default with an explicit control (browsers block autoplay) | No audio without a user gesture |
| 5 | Data and method panel; privacy mode inside the Wrap | Personal stories skipped when hidden |
| 6 | Snapshots and archive in IndexedDB; lifecycle activity events | A past Wrap reopens from its snapshot |
| 7 | Sharing: share-card image download and Web Share where available (no video export on the web) | Image contains only public or explicitly chosen content |
| 8 | Home context card and recap menu wired | Friday scenario opens the Wrap from `/inicio` |

**How to test.** `npm run check`. Playwright flow in `demo` (Friday scenario): open, complete, confirm it leaves the context slot and stays in the recap menu.

**Exit criteria**
- [ ] Only `is_final` evidence is used (test).
- [ ] An expired period cannot be opened by URL.
- [ ] The player is fully usable with keyboard and screen reader (explicit next/previous buttons).
- [ ] The shared image never includes portfolio amounts.

**Prompt**

```text
Phase W15 — Weekly Wrap (invest.ao website).

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W15", docs/reference/ios-product.md section 2.10, and docs/reference/backend-contract.md sections 3.8 and 4.9.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/WeeklyWrap, docs/weekly-wrap.md, and tests VerifiedWeeklyWrapTests, WeeklyWrapTests, WrapAvailabilityRepositoryTests.

Implement every task of W15. Assembly in src/domain with the iOS tests ported; the player is UI only.

Constraints: computed in the browser from server evidence; never invent a value. Always-dark surface. Signed-in only and never cached. Video export is out of scope on the web.

Verify: npm run check, npm run e2e including the keyboard walk-through. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W16 — Subscriptions

**Goal.** Tier status, locks, the plans page, referrals and — if approved — checkout on the web. Needs WB2 for checkout.

**Source of truth.** Product §6; platform §8; contract §7; iOS `Core/Subscriptions`, `Features/Subscriptions`.

| # | Task | Done when |
|---|---|---|
| 1 | Access store from `get_subscription_access()`; everything open unless `enforcement_enabled` | Ports the iOS subscription-store cases |
| 2 | `/planos` (always dark, own palette): hero with reason sentence, comparison tables Grátis/Plus and Plus/Pro, membership block, referral block, status lines, terms and privacy links, "prefer free" disclosure with the Free selection link | Every element of product §6.3 that applies to the web is present |
| 3 | Lock presentation: every typed limit reason from W7, W8, W11, W12 opens `/planos` (as a dialog over the current page) with its sentence; after access changes, the blocked action resumes once | Matrix of the 17 triggers attached, each verified |
| 4 | Checkout (if decision 4 is yes): RevenueCat Web Billing with app user id = Supabase user id, annual preselected with savings pill, 7-day trial copy, prices only from the provider; on return `POST /api/billing/sync` calls `sync-subscription` server-side, then access is re-read | A test-mode purchase flips `free@…` to Plus on the local stack; `BILLING_RATE_LIMIT` handled |
| 5 | No checkout (if decision 4 is no): the page shows status and how to subscribe in the mobile apps | No dead purchase button |
| 6 | Manage: web purchases → provider customer portal; App Store / Play purchases → instructions and links to the store where the subscription was bought | The store of origin comes from the billing SDK's customer info, not guessed |
| 7 | Referral: code with copy and share, redeem dialog with all error messages, credit-until line; hidden when referrals are closed; pending code from `/convite/[code]` offered once | Verified on the local stack |
| 8 | Lifetime gift announcement (`claim_lifetime_plus_announcement`), shown once | |
| 9 | Downgrade: nothing deleted; Free selection from W8 | Lapsed seed account sees paused instruments |

**How to test.** `npm run check`. `local` mode: stub RevenueCat as in WB2 to flip tiers and confirm locks open and the blocked action resumes. Test-mode checkout end to end on a preview.

**Exit criteria**
- [ ] A web purchase shows as Plus on iOS for the same account (owner cross-check), or the no-checkout variant is live.
- [ ] With enforcement off, no lock appears anywhere.
- [ ] No price is hard-coded; no RevenueCat secret is in the bundle.
- [ ] All triggers show their own reason sentence.

**Prompt**

```text
Phase W16 — subscriptions (invest.ao website).

Precondition: tell me whether web checkout is approved (owner decision 4). If yes, backend phase WB2 must be merged and deployed; if it is not, stop. If no, build the status-only variant.

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W16", docs/reference/ios-product.md section 6, docs/reference/ios-platform.md section 8, and docs/reference/backend-contract.md section 7.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Subscriptions, Features/Subscriptions, docs/subscription-foundation.md.

Implement every task of W16 and replace the neutral limit dialogs left by earlier phases.

Constraints: the backend snapshot is the only authority for access. sync-subscription is called from a route handler with the user's session, never from the browser. Prices, periods and trial eligibility come from the billing provider. Purchase requires a signed-in user. The site must not be embedded as a checkout inside the mobile apps.

Verify: npm run check, npm run e2e, local-mode lock/resume checks, and a test-mode purchase if checkout is enabled. Attach the trigger matrix. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W17 — Web Push and installability

**Goal.** Optional browser notifications with the same privacy rules, and an installable site. Needs WB3 and owner decision 7.

| # | Task | Done when |
|---|---|---|
| 1 | Web app manifest, icons, theme colours; installable on Chromium and Safari | Lighthouse installability passes |
| 2 | Service worker limited to push handling and notification clicks (no offline caching of account data) | Signed-in responses are never stored by the worker (test) |
| 3 | Permission requested only on a user action in notification settings or after saving an alert; never on page load | Fresh visit shows no prompt |
| 4 | Subscribe → route handler → `register-web-push` with `notificationLanguage`; unsubscribe on sign-out and when permission is revoked | Subscription row appears and disappears on the local stack |
| 5 | Push display: server `title`/`body`, generic text for private categories, drop when the payload's `user_id` is not the signed-in user; click focuses or opens the route for the category and acknowledges the notification | Each category opens its destination |
| 6 | Income payment-day reminders and the W8 delivery note updated now that push exists | No stale "mobile only" note for subscribed browsers |

**How to test.** Playwright with granted notification permission against the local stack: subscribe, trigger an alert rule, assert the displayed notification text is generic and the click lands on the instrument.

**Exit criteria**
- [ ] No prompt without a user gesture.
- [ ] Lock-screen/OS text is generic for explicit alerts and `portfolio_daily`.
- [ ] Sign-out removes the subscription server-side.
- [ ] The service worker caches nothing account-scoped.

**Prompt**

```text
Phase W17 — Web Push and installability (invest.ao website).

Precondition: backend phase WB3 is merged and deployed to the environment you test against. If not, stop.

Read AGENTS.md, docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W17", docs/reference/ios-product.md section 7.5, and docs/reference/backend-contract.md sections 10.4 and 10.7.

Implement every task of W17.

Constraints: the service worker handles push and clicks only. Validate payload keys strictly and fail closed. Never place amounts, thresholds or the user's relationship to an instrument in a notification. The registration call goes through a route handler.

Verify: npm run check, npm run e2e with notification permission granted. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### W18 — Hardening and launch

**Goal.** A site fit to take over `invest.ao`.

| # | Task | Done when |
|---|---|---|
| 1 | Accessibility audit of every route: keyboard path, focus order, names and roles, contrast (including `prefers-contrast`), 200 % zoom, 320 px width, reduced motion | `docs/release/accessibility.md` with a row per route; axe clean in CI for all routes |
| 2 | Performance: Lighthouse budgets on `/`, `/mercado`, `/mercado/[symbol]`, `/noticias/[slug]`, `/inicio`; route-level code splitting verified; images sized | LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms (mobile profile) on each |
| 3 | Security review: CSP without `unsafe-inline`, cookie flags, open-redirect and CSRF tests, dependency audit, bundle secret scan, `/partilha` and signed-in caching rules, rate limiting on route handlers | `docs/release/security.md` with evidence per item |
| 4 | SEO final: sitemap, canonical, `hreflang`, structured data validation, 404s, redirect map from the old site's live URLs | Crawl of the preview shows no broken internal link |
| 5 | Observability: Sentry source maps, uptime check on `/` and `/api/market/snapshot`, error budget alerting | A test error appears de-minified |
| 6 | Full regression on a production-mode preview with the owner's account: M2 smoke plus portfolio, wrap, subscriptions | Signed-off run recorded |
| 7 | Cut-over runbook: DNS, `SITE_URL`, auth redirect allow-list, `APPLE_WEBSITE_RETURN_URL`, `assetlinks.json` fingerprints, rollback step | `docs/release/cutover.md`; `/policy` and `/partilha/*` verified on the new origin immediately after the switch |

**Exit criteria**
- [ ] All budgets and audits green on the release commit.
- [ ] The production bundle contains no demo fixtures, password sign-in or development URLs (inspected and listed).
- [ ] `https://invest.ao/policy` and an existing iOS share link work after cut-over (owner check).
- [ ] Owner regression signed off.

**Prompt**

```text
Phase W18 — hardening and launch (invest.ao website).

Read AGENTS.md and docs/plan/WEBSITE_IMPLEMENTATION_PLAN.md section "W18", plus docs/reference/ios-platform.md section 11.2 for the URLs the iOS app depends on.

Implement every task of W18. Fix what the audits find; do not add features.

Constraints: you cannot change DNS, hosted auth settings or production secrets — prepare everything and leave those steps as an exact owner runbook with a rollback. /policy and /partilha/* must work at their exact paths the moment the domain switches.

Verify on a production-mode preview and attach the audit documents. Tick exit criteria with evidence. Finish per AGENTS.md.
```
