# invest.ao Android — implementation plan

Target: a native Android app at full parity with iOS 1.1.5 (build 18), built from an empty folder.
Sources of truth: the live backend contract and the iOS app. See [README.md](README.md) for setup, owner decisions and open facts.

## 1. Ground rules

### 1.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Language / UI | Kotlin 2.x, Jetpack Compose, Material 3 as the base layer under invest.ao tokens | Mirrors native Swift/SwiftUI |
| SDK levels | `minSdk 26`, `targetSdk`/`compileSdk` = latest stable at A0 | `java.time` without desugaring, adaptive icons, notification channels |
| Application id | `ao.invest.androidapp`, debug suffix `.development` | Owner decision 2 |
| Modules | `:domain` (pure Kotlin/JVM, no Android), `:data` (Supabase, storage), `:designsystem` (tokens, components, icons), `:app` (features, navigation), `:widgets` (Glance) | Pure logic tests run on the JVM in seconds |
| Backend SDK | `supabase-kt` (Auth, Postgrest, Functions, Realtime) on Ktor OkHttp, `kotlinx.serialization` | Same surface the iOS app uses |
| DI | Hilt | |
| Navigation | Navigation Compose with type-safe routes | |
| Money / time | `java.math.BigDecimal` (scale 8), `java.time` fixed to `Africa/Luanda` | Ledger is `numeric(24,8)`; trading days are Luanda civil dates |
| Storage | DataStore (preferences), JSON files in app storage for caches | iOS has no offline database either |
| Images | Coil | Issuer logos with monogram fallback |
| Charts | Own Compose Canvas chart | iOS rules are specific (linear, scrub to real observations, pinned endpoints) |
| Sign-in | Credential Manager (Google ID token), Supabase OAuth in a Custom Tab (Apple) | |
| Push | `firebase-messaging` on the client only | Requires backend phase AB1 |
| Billing | RevenueCat `purchases-android` | Backend verifies through RevenueCat |
| Telemetry | PostHog Android (allow-listed events), Sentry Android (own project) | |
| Background | WorkManager | Widget refresh, income reminders |
| Tests | `kotlin.test` + JUnit on `:domain`/`:data`, Roborazzi screenshots for the design system, a small Compose UI suite, Maestro smoke flows on an emulator | Proportional: golden fixtures over mirrored tests |

### 1.2 Standing rules (phase A0 writes these into the new repo's `AGENTS.md`)

1. **Sources, in order of authority:** live backend behaviour → `docs/reference/backend-contract.md` → iOS code in `../.reference/ios` → iOS docs → `docs/reference/ios-*.md`. Where iOS docs and code disagree, code wins. Never read or copy from any earlier Android or website project.
2. **Prices.** A price is shown as current only with valid, unexpired evidence (`data_quality.status = valid`, no reasons, Luanda trading date = today, now < `validUntilEpoch`, calendar unexpired). Otherwise show the dated verified close or `Preço por confirmar`. Never zero, never a stale number as current, never the words "live" or "tempo real".
3. **Market state** comes from the server calendar evaluated in `Africa/Luanda`. No hard-coded trading hours, no device time zone.
4. **Numbers.** `BigDecimal` for every ledger, cash, threshold and valuation value; `LocalDate` for `traded_on`, `trading_date`, `occurred_on`. No `Double` in portfolio or simulator maths.
5. **Limits are the server's.** Tier limits arrive as PostgREST errors (`P0001` + message such as `FREE_WATCHLIST_LIMIT`). Features are open unless `get_subscription_access().enforcement_enabled` is true and the build has subscriptions enabled.
6. **No automatic request retries.** Only the market poll loop retries, with full-jitter backoff and `retry_after_seconds`. Re-check the signed-in user id after every suspension point before applying a result.
7. **Privacy.** Never put account data, amounts or instrument ids in analytics, logs or URLs. Telemetry is installation-scoped and allow-listed; the user is never identified.
8. **Copy.** Angolan Portuguese addressing the user as "tu", sentence case; `pt` is the default resource set, `en` the alternative. Every user-visible string is a resource. Reuse iOS wording verbatim; cut taglines, helper text and secondary labels.
9. **Design.** Financial values are the hero. Do not turn every section into a card. Gain/loss colour applies to changes only. Light and dark are both first-class. Touch targets ≥ 48 dp, TalkBack labels on every control, layouts hold at font scale 2.0.
10. **Backend changes are never worked around.** If a phase needs something the backend does not provide, stop and report; the fix belongs in a backend phase.
11. **Secrets** stay out of the repo. Keys are read from `local.properties` / CI secrets by name.
12. **Git.** One task branch per phase, Conventional Commits, push, open a PR to `main` with the verification performed. No mention of AI tooling in commits, code or docs.
13. **Tests are proportional.** Golden fixtures and contract tests for logic; a screenshot or a single flow for UI. No tests that restate the implementation.

### 1.3 Build variants and test data

| Variant | Backend | Use |
|---|---|---|
| `demo` | None. Repositories are fakes fed by recorded fixtures in `app/src/demo/assets/fixtures/` | Screenshots, Compose UI tests, Maestro flows, offline development. Scenarios selected by an intent extra, like iOS launch arguments |
| `development` | Local Supabase stack (`http://10.0.2.2:54321`) seeded by backend phase B0 | Integration of writes, auth, limits. Has a debug-only email/password sign-in for B0's test users |
| `production` | Hosted project | Release builds and owner smoke tests only. No automated test ever targets it |

Public, read-only production reads (`GET /functions/v1/market-snapshot`) may be recorded once into fixtures; nothing else touches production from a test.

### 1.4 Definition of done for every phase

- All tasks in the phase section meet their "Done when".
- `./gradlew ktlintCheck detekt lintDebug :domain:test :data:test :app:testDemoDebugUnitTest :app:assembleDemoDebug` passes.
- New UI verified on an emulator in light and dark, `pt` and `en`, font scale 1.0 and 2.0, with TalkBack labels checked on new controls.
- Exit criteria ticked in the PR description, each with evidence (test name, screenshot path, or command output).
- No new string outside resources, no new `Double` in money paths, no new dependency without a line of justification in the PR.

### 1.5 Phase map

| Milestone | Phases | Outcome |
|---|---|---|
| Backend enablement | B0, AB1, AB2, AB3 | Seeded local stack; Android push, billing and sign-in accepted by the backend |
| M1 — Core (internal testing) | A0–A9 | Sign in, browse the market, instrument detail, watchlist, alerts, notifications, settings, account deletion |
| M2 — Portfolio | A10–A11 | Manual ledger with full parity |
| M3 — Insight | A12–A14 | Content screens, intelligence, Weekly Wrap |
| M4 — Launch | A15–A17 | Subscriptions, widgets and system surfaces, release |

Dependencies: A1 and A2 need A0. A3 needs A2. A4 needs A1 + A3. A5–A7 need A4. A8 needs A7 + AB1. A9 needs A4. A10 needs A2 + A4. A11 needs A10. A12 needs A6. A13 needs A7 + A10. A14 needs A13. A15 needs A7 + AB2. A16 needs A10. A17 needs everything. The app must not go to a public track before A15 if enforcement is on in production, because a Free user would hit limits with no way to subscribe.

---

## 2. Backend phases (run in `investao-functions/`)

### B0 — Client development seed

**Goal.** A fresh local stack shows a believable market and has test accounts, so Android and web can integrate without production. Shared with the website plan; skip if already merged.

| # | Task | Done when |
|---|---|---|
| 1 | `supabase/seeds/client_dev.sql` (not loaded in production): ≥ 12 securities across stock, bond, treasury bond and fund, issuers with logos and dividends, 400 trading days of `price_history`, today's session with quotes, order books, 5-minute candles for 3 instruments, verified calendar covering today ± 60 days, 6 published news articles (one weekly recap), unusual-activity events, one `market_events` new listing, a valid `intelligence_feature_configuration` row | `supabase db reset` followed by the seed gives `market-snapshot` ≥ 12 `prices` rows with `data_quality.status = "valid"` during seeded market hours |
| 2 | `scripts/seed-client-dev.ts`: creates three users with the admin API (`free@`, `plus@`, `pro@` test addresses, password from env `CLIENT_DEV_PASSWORD`), gives Plus and Pro entitlements, a watchlist, alert rules, a 30-row ledger and notifications | Password sign-in works for all three against the local stack; `get_subscription_access()` returns the expected tier for each |
| 3 | A switch to turn enforcement on locally | With enforcement on, the free user's 4th watchlist insert fails with `FREE_WATCHLIST_LIMIT` |
| 4 | `docs/client-development.md` | Explains start, reset, seed, the three accounts, and how to move the seeded "now" |

**How to test.** `supabase db reset && deno run -A scripts/seed-client-dev.ts`, then `curl` `market-snapshot`, sign in as each user with the anon key, call `get_subscription_access`. `deno task test` stays green.

**Exit criteria**
- [ ] The four "Done when" checks pass on a clean machine following only `docs/client-development.md`.
- [ ] The seed is never referenced by `config.toml` seeding for hosted projects and contains no production data.

**Prompt**

```text
Phase B0 — client development seed (invest.ao backend).

Read AGENTS.md, docs/BACKEND_ARCHITECTURE.md, supabase/seed.sql, and ../plans/reference/backend-contract.md sections 3, 4, 5, 7 and 15.

Implement section "B0 — Client development seed" of ../plans/ANDROID_IMPLEMENTATION_PLAN.md: every task, every "Done when", every exit criterion.

Constraints: local development only. Do not touch production, do not change any existing migration, do not add the seed to hosted seeding. Insert through the same tables and RPCs the ingestion uses so views and data-quality fields come out valid; if a view needs evidence rows to report "valid", create that evidence rather than faking the view. Passwords come from an env var named in .env.example, never from the repo.

Verify with the commands under "How to test" and paste their output in the PR. Finish per AGENTS.md: task branch, Conventional Commit, push, PR to main.
```

### AB1 — Push for Android (FCM transport)

**Goal.** The backend can register an Android device and deliver every notification kind to it. Needs owner decision 1.

| # | Task | Done when |
|---|---|---|
| 1 | Migration: `device_tokens` gains `platform` (`ios`\|`android`\|`web`, default `ios`) and a generic `push_token`; token-format and bundle constraints become per-platform; uniqueness on `(platform, push_token, environment)`; existing iOS rows untouched | pgTAP: an iOS row still validates as before; an Android row with a 160-char token and app id `ao.invest.androidapp` inserts; a malformed token for either platform is rejected |
| 2 | `register-device` accepts `platform`, `fcmToken`, `applicationId`, and `dailyCloseCapable`; unknown keys still rejected; iOS requests unchanged | Deno tests: existing iOS cases pass unmodified; Android happy path returns 201; `apnsToken` with `platform: android` → 400 |
| 3 | `_shared/fcm.ts`: FCM HTTP v1 with service-account OAuth, data-only messages carrying the routing keys of contract §10.4 plus rendered `title`/`body`, `collapse_key` = notification id, TTL from expiry, high priority for alerts; `UNREGISTERED`/`INVALID_ARGUMENT` disable the token | Unit tests with a stubbed fetch cover success, retryable failure, token invalidation |
| 4 | Transport branches by platform in the account pipeline, explicit alerts and silent refresh; privacy rules identical (generic text for private categories) | A queued delivery for an Android device calls the FCM sender; a `portfolio_daily` payload contains only the generic copy |
| 5 | Audience mapping for Android (`environment: sandbox` → `beta`) and the hard-coded bundle filters updated | Feature-config gate tests pass for an Android device |
| 6 | Secrets documented by name (`FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON`) in `.env.example`; `AGENTS.md` rule reworded to allow FCM as a transport only; `docs/NOTIFICATIONS.md` updated | Docs describe the Android contract end to end |

**How to test.** `deno task test` (unit, edge, db). Then against the local stack: register an Android device as the B0 free user, insert an alert rule that the seeded quote satisfies, run `process-notifications` with FCM pointed at a local capture server, inspect the captured request.

**Exit criteria**
- [ ] All iOS notification tests pass without edits to their expectations.
- [ ] Captured FCM request for an alert rule, an asset movement and a daily close match the documented payload.
- [ ] Migration is forward-only and replays on an empty database in CI.

**Prompt**

```text
Phase AB1 — push for Android (invest.ao backend).

Read AGENTS.md, docs/NOTIFICATIONS.md, docs/notification-platform.md, supabase/functions/_shared/{apns.ts,account_notifications.ts,silent_refresh.ts}, supabase/functions/register-device, tests/device_validation_test.ts, and ../plans/reference/backend-contract.md sections 4.6, 9.2, 10 and 11.

The owner has approved FCM as a delivery transport only (no Firebase database, auth or SDK in this repo); update the AGENTS.md rule accordingly as part of this change.

Implement section "AB1 — Push for Android" of ../plans/ANDROID_IMPLEMENTATION_PLAN.md: every task, "Done when" and exit criterion. Keep the `web` platform value in the migration so the website's Web Push phase needs no second schema change.

Constraints: iOS behaviour and payloads must not change; existing tests keep their expectations. Lock-screen privacy rules apply to Android exactly as to iOS. Never log tokens. One forward-only migration, no edits to old ones.

Verify with "How to test". Finish per AGENTS.md.
```

### AB2 — Google Play purchases

**Goal.** A Play subscription grants the same Plus/Pro entitlement as an App Store one.

| # | Task | Done when |
|---|---|---|
| 1 | `_shared/subscriptions.ts` accepts `store === "play_store"` and the Play product ids, mapped to tiers by the same lists | `tests/subscriptions_test.ts`: a RevenueCat subscriber fixture with a Play `plus` and a Play `pro` entitlement yields the right tier; an unknown store still fails with `BILLING_RESPONSE_INVALID` |
| 2 | `docs/subscriptions.md`: Play products, RevenueCat entitlement mapping, sandbox (licence testers), cross-store behaviour (latest snapshot wins) | A reader can configure Play + RevenueCat from the doc alone |
| 3 | Manual checklist for the owner (Play Console subscriptions, base plans, 7-day trial offer, RevenueCat Android app, service credentials) | Checklist is in the doc with each item verifiable |

**How to test.** `deno task test:unit`. On the local stack, stub the RevenueCat fetch with the Play fixture, call `sync-subscription` as the B0 free user, then `get_subscription_access()`.

**Exit criteria**
- [ ] App Store fixtures give unchanged results.
- [ ] Play fixture → `is_plus` / `is_pro` as expected.

**Prompt**

```text
Phase AB2 — Google Play purchases (invest.ao backend).

Read AGENTS.md, docs/subscriptions.md, supabase/functions/_shared/subscriptions.ts, tests/subscriptions_test.ts, and ../plans/reference/backend-contract.md sections 7 and 12.2.

Implement section "AB2 — Google Play purchases" of ../plans/ANDROID_IMPLEMENTATION_PLAN.md. Product ids: use the four existing ids unless the owner supplied others in this conversation; put them in one allow-list per store.

Constraints: no migration; entitlement semantics and the App Store path unchanged; nothing the client sends may grant access.

Verify with "How to test". Finish per AGENTS.md.
```

### AB3 — Sign-in and deletion for Android (configuration)

**Goal.** Google and Apple sign-in on Android resolve to the same account as on iOS, and Apple-linked accounts can be deleted from Android.

| # | Task | Done when |
|---|---|---|
| 1 | Owner checklist in `docs/android-auth.md`: Google OAuth Android client (package + SHA-1 for debug, upload and Play signing keys) and its web client id added to the Supabase Google provider; Apple Services ID listed first in the Apple provider client ids; redirect allow-list gains `investao://auth/callback` (already present) and `https://invest.ao/auth/callback` | Each item names where it is set and how to confirm it |
| 2 | Confirm `apple-web-deletion` native return works for Android: `APPLE_WEB_RETURN_URL` uses the `investao://` scheme the Android app also registers | Local run of `/start` → callback → 303 to `investao://…?status=deleted` with a stubbed Apple |
| 3 | `supabase/config.toml` local auth: add the redirect URLs so the local stack matches | `supabase start` accepts the Android redirect |

**Exit criteria**
- [ ] A Google account that already exists from iOS signs in on an Android debug build and sees the same watchlist (owner smoke test, recorded in the PR).
- [ ] Deletion state machine test passes for `returnPlatform: native`.

**Prompt**

```text
Phase AB3 — sign-in and deletion for Android (invest.ao backend).

Read AGENTS.md, docs/apple-account-deletion.md, supabase/config.toml, supabase/functions/_shared/apple_web_deletion.ts, tests/apple_web_deletion_test.ts, and ../plans/reference/backend-contract.md sections 1, 11 and 12.1.

Implement section "AB3" of ../plans/ANDROID_IMPLEMENTATION_PLAN.md. Most of this phase is a precise owner checklist plus local config; do not change hosted settings yourself and do not invent client ids — leave named placeholders for the owner.

Verify the deletion flow locally with a stubbed Apple endpoint. Finish per AGENTS.md.
```

---

## 3. App phases

Every prompt below is run with Claude Code opened in the new Android project folder (A0 is the exception). Paths: iOS source `../.reference/ios`, backend source `../.reference/backend`, plan `docs/plan/ANDROID_IMPLEMENTATION_PLAN.md`, references `docs/reference/`.

### A0 — Foundation

**Goal.** An empty, buildable, verifiable project with the rules, references and CI in place.

| # | Task | Done when |
|---|---|---|
| 1 | Create the project in a new folder `investaoandroid/` (abort if it exists), `git init`, modules of §1.1, version catalog, Gradle wrapper | `./gradlew :app:assembleDemoDebug` succeeds from a clean clone |
| 2 | Flavors `demo`, `development`, `production` with `BuildConfig` fields read from `local.properties` by name (`INVESTAO_SUPABASE_URL`, `INVESTAO_SUPABASE_KEY`, `INVESTAO_GOOGLE_WEB_CLIENT_ID`, `INVESTAO_REVENUECAT_PUBLIC_KEY`, `INVESTAO_POSTHOG_PROJECT_TOKEN`, `INVESTAO_SENTRY_DSN`, `INVESTAO_SUBSCRIPTIONS_ENABLED`); `local.properties.example` | A build with no `local.properties` still assembles `demo`; `development`/`production` fail with a message naming the missing key |
| 3 | `AGENTS.md` with §1.2–§1.4 verbatim; `docs/plan/` and `docs/reference/` copied from `../plans`; fixtures copied to `domain/src/test/resources/fixtures/` unchanged | `sha256sum` of each fixture equals the source file |
| 4 | Static checks: ktlint, detekt, Android lint (warnings as errors for `HardcodedText`, `MissingTranslation`) | `./gradlew ktlintCheck detekt lintDemoDebug` passes |
| 5 | CI workflow: static checks, JVM tests, `assembleDemoDebug`, `assembleProductionRelease` compile-only | Workflow file runs the same commands as §1.4 |
| 6 | Launcher icon and splash from the iOS master (`Design/AppIcon/invest-ao-master.svg`), splash background `#02050A` | Adaptive icon renders in the launcher; splash shows the mark |
| 7 | Confirm the open facts in `../plans/README.md` that can be read without privileged access; record answers in `docs/reference/live-facts.md` | File lists each fact as confirmed (with how) or "owner to confirm" |

**How to test.** Clean clone → commands in tasks 1, 2, 4. Install the demo APK on an emulator: it opens to a placeholder screen with the correct icon and splash.

**Exit criteria**
- [ ] §1.4 command passes on CI.
- [ ] No file from any previous Android project exists in the repo history.
- [ ] `AGENTS.md`, plan, references and fixtures are present and byte-identical where copied.

**Prompt**

```text
Phase A0 — foundation for the new invest.ao Android app.

You are in the workspace root (invest.ao-app/). Read plans/README.md and plans/ANDROID_IMPLEMENTATION_PLAN.md sections 1 and "A0".

Preconditions — stop and tell me if any fails: the folder investaoandroid/ does not exist; .reference/ios and .reference/backend exist (README "How to run a phase" step 2). Do not open, list or search any other Android or website project anywhere on disk.

Create investaoandroid/ as a new git repository and implement every task in section A0. Use the application id ao.invest.androidapp unless I gave another. Choose current stable versions of Kotlin, AGP, Compose BOM and libraries, pin them in the version catalog, and list them in the PR description.

Constraints: no feature code beyond a placeholder screen. No secrets or key values in the repo — names only. AGENTS.md must contain plan sections 1.2, 1.3 and 1.4 word for word.

Verify with "How to test" and the Definition of done command. Commit with Conventional Commits. If a remote exists push and open a PR; otherwise leave the branch committed and say so.
```

### A1 — Design system, formatting, localisation

**Goal.** Every later screen is assembled from tokens, components, formatters and strings that already match iOS.

**Source of truth.** `docs/reference/ios-product.md` §3 and §4; iOS `Invest.AO/Core/DesignSystem`, `Core/Components`, `Core/Formatting`, `Resources/Localizable.xcstrings`, `Tools/IconPack/masters.json`, `Resources/Assets.xcassets/Icons`.

| # | Task | Done when |
|---|---|---|
| 1 | Colour tokens: the 21 light/dark pairs and increased-contrast values of §3.2, exposed as `InvestTheme.colors`; Material colour scheme derived from them | A unit test asserts every token's hex in light and dark against a table transcribed from `SemanticColors.swift` |
| 2 | Type roles of §3.3 mapped to `sp` (44/34/22/20/17/15/12/11) with tabular figures for numbers; spacing 4–40, radii 12/18/24/pill, sizes of §3.4 | Gallery shows each role; numbers do not shift width when digits change |
| 3 | Icon pack: 56 icons generated from the iOS masters into vector drawables by a script in `tools/icons`, plus the system-name bridge | Script is re-runnable; 56 drawables exist; gallery page lists all by name |
| 4 | Components of §3.9 needed across features: buttons (primary/secondary/icon), action tile, asset row, feature row, card, section header, page heading, section tabs, segmented control, time-range picker, search field, financial value text, change badge, market metric, market status indicator, logo with monogram fallback, loading/empty/error states, skeletons, section placeholder, error toast host, offline banner, sensitive value, amount field | Each has a `@Preview` and appears in a debug gallery screen reachable in `demo` |
| 5 | Formatters in `:domain`: number, AOA currency (0 decimals amounts, 2 prices), signed percent, tiny-percent bands, percentage points, bond % of par, quantity, compact axis, integer counts, dates, timestamps with `· Luanda`, periods, relative day — for `pt_AO` and `en_AO` | Table-driven tests reproduce every example in §4.3 and the cases of iOS `FinancialPresentationTests` and `CivilDatePresentationTests` |
| 6 | Amount input: decimal comma, `.` typed becomes `,`, live grouping, 2–8 fraction digits, caret preserved | Tests port iOS `AmountInputFormattingTests` and `LiveAmountEditingTests` cases |
| 7 | Strings: `tools/strings` converts `Localizable.xcstrings` to `values/strings.xml` (pt) and `values-en/strings.xml`, dotted keys → snake_case, sentence keys → generated dotted names recorded in a mapping file, `%@`/`%lld` → positional Android specifiers, plurals kept | Conversion is deterministic; lint `MissingTranslation` passes; a test checks placeholder counts match between pt and en for every key |
| 8 | Motion and haptics helpers per §3.6 with reduced-motion fallbacks (system animator scale 0) | Press, presence and numeric-roll helpers exist and are used by the components |
| 9 | Roborazzi baseline of the gallery: light/dark × font scale 1.0/2.0 | `./gradlew verifyRoborazziDemoDebug` passes; images committed |

**How to test.** JVM tests for tasks 1, 5, 6, 7. Screenshot verification for task 9. Manual: open the gallery on an emulator, toggle dark mode, set font scale 2.0, turn on TalkBack and sweep the asset row, change badge and status indicator (spoken as "Subiu/Desceu …").

**Exit criteria**
- [ ] Formatter tests cover every row of §4.3 in both locales.
- [ ] No component draws a hard-coded colour, size or string.
- [ ] Gallery baseline committed for four configurations.
- [ ] 56 icons present; none substituted with Material icons.

**Prompt**

```text
Phase A1 — design system, formatting, localisation (invest.ao Android).

Read AGENTS.md, then docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A1", then docs/reference/ios-product.md sections 3 and 4.
iOS source to translate (read-only): ../.reference/ios/Invest.AO/Core/DesignSystem, Core/Components, Core/Formatting, Core/Charts (visual constants only), Resources/Localizable.xcstrings, Resources/Assets.xcassets/Icons, Tools/IconPack, and the tests FinancialPresentationTests, AmountInputFormattingTests, LiveAmountEditingTests, CivilDatePresentationTests, LocalizationTests under Tests/MarketDiscoveryTests.

Implement every task of A1. Token values come from the Swift code, not from the iOS docs (the docs' hexes are stale). Translate behaviour, not SwiftUI structure: no glass imitation — bars use solid or translucent Material surfaces and content stays opaque.

Constraints: formatters live in :domain with no Android imports. Port the iOS test cases as table-driven tests rather than inventing new ones. The string converter must be a committed script, not a one-off edit.

Verify: ./gradlew :domain:test :designsystem:testDemoDebugUnitTest verifyRoborazziDemoDebug lintDemoDebug, then the manual checks under "How to test" on an emulator; attach four gallery screenshots to the PR. Tick the exit criteria in the PR. Finish per AGENTS.md.
```

### A2 — Domain core

**Goal.** The pure rules that decide what the app may show: models, decoding, calendar, quote policy, classification, discovery, time ranges.

**Source of truth.** `docs/reference/backend-contract.md` §2–3, §9.1, §13; `docs/reference/ios-platform.md` §3.1, §6, §12.6; iOS `Invest.AO/Core/Market/Domain/**` and its tests.

| # | Task | Done when |
|---|---|---|
| 1 | Models: security (kinds stock/fund/corporate bond/treasury bond/other), issuer, quote with `DataQuality`, session, overview, availability, reference price, verified close, pulse point, calendar document (contract v2), client control | Decoding `fixtures/home-compact-contract.json` yields the expected counts and values (test ports iOS `HomeCompactContractTests`) |
| 2 | Tolerant decoding: unknown enum values and missing optional keys never fail a whole payload; numbers parsed as `BigDecimal` | Tests port iOS `TolerantMarketDecodingTests` cases |
| 3 | Market calendar: status open / opening soon / closed / unknown from the calendar document in `Africa/Luanda`; expiry (121 s direct, bundled until snapshot `fresh_until`); weekday alone proves nothing | Tests port iOS `MarketCalendarTests`; a device in `America/New_York` gets identical results |
| 4 | Current-quote policy: eligibility, revocation triggers (expired calendar, failed refresh, offline, prior session, backgrounding), local downgrade deadline, display precedence quote → BODIVA reference → verified close → last reported quote with distinct labels; only `verified_change_percent` feeds calculations | Tests port iOS `CurrentQuotePolicyTests`, `DataQualityTests`, `VerifiedClosingPricesTests`, `MarketReferencePriceTests`, `MarketQuoteDateTests` |
| 5 | Security classification and visibility (matured bonds decoded from the symbol), bond price semantics (% of par, p.p.) | Tests port `SecurityKindClassificationTests` |
| 6 | Discovery: category filter, accent-insensitive search over symbol/name/issuer (accepting `ação`/`acção`), sorts with missing values last and symbol tie-break, movers (gains/declines/volume) | Tests port `MarketDiscoveryTests`, `GlobalSearchLogicTests`, `MarketDisplayMovementTests` |
| 7 | Time ranges `1D 1S 1M 3M 6M 1A Tudo` and availability rule (≥ 2 points, span ≥ max(7, 90 % of range), 1D only on trading days) | Tests port the `TimeRange` cases |
| 8 | Refresh policy: 30 s open, 60 s closed/opening soon, 120 s with realtime connected, server floor `min_poll_seconds`, maintenance 300 s, full-jitter backoff to 5 min, `retry_after_seconds` | Tests port `MarketRefreshBackoffTests`, `MarketAutomaticRefreshTests` (policy parts) with an injected clock |
| 9 | Error taxonomy (`AppError` categories of platform §10) and mapping from HTTP/PostgREST errors, including `P0001` business messages → typed limits | Tests port `AppErrorTests`, `SupabaseErrorBoundaryTests` |

**How to test.** `./gradlew :domain:test`. All tests use an injected clock; no test sleeps or reads the system zone.

**Exit criteria**
- [ ] Each iOS test file named above has a Kotlin counterpart with the same cases (list them in the PR with case counts).
- [ ] `:domain` has no Android, Supabase or coroutine-dispatcher dependency beyond `kotlinx-coroutines-core`.
- [ ] No `Double` in any price, change or threshold type.

**Prompt**

```text
Phase A2 — domain core (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A2", docs/reference/backend-contract.md sections 2, 3, 9.1 and 13, and docs/reference/ios-platform.md sections 3.1, 6, 10 and 12.6.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Market/Domain (Models, Policies), Core/Errors, and the test files named in section A2 under Tests/MarketDiscoveryTests.

Implement every task of A2 in the :domain module as pure Kotlin. Port the listed iOS tests case for case — they are the specification. Where a Swift test relies on Foundation behaviour, reproduce the expected values, not the mechanism.

Constraints: clock and zone are always injected; the market zone is Africa/Luanda regardless of device. BigDecimal for all prices and percentages. Trading hours are never hard-coded: they come from the calendar document. If the backend contract and iOS code disagree, follow the contract and note it in the PR.

Verify: ./gradlew :domain:test. In the PR list each ported test file with its case count and tick the exit criteria. Finish per AGENTS.md.
```

### A3 — Data layer and market store

**Goal.** One shared, well-behaved source of market state for the whole app.

**Source of truth.** Contract §3, §8, §9.1, §13; platform §3.0–3.1, §5, §6, §9.1–9.3, §10; iOS `Core/Networking`, `Core/Market` (repositories, store), `Core/Telemetry`, `Core/FeatureFlags`.

| # | Task | Done when |
|---|---|---|
| 1 | Supabase client factory (URL + publishable key from `BuildConfig`), session storage in encrypted DataStore, SDK retries disabled on reads | A `development` build reads `securities` from the local stack |
| 2 | Snapshot repository: `GET market-snapshot` with `If-None-Match`, 304 handling, contract-version check; fallback to `securities` + `get_current_market_quotes` + `latest_verified_market_closes` on contract/4xx failure and for 5 minutes after a 5xx/timeout; never both routes in one refresh | MockWebServer tests port iOS `MarketSnapshotRouteTests`, `BundledSnapshotExtrasTests`, `PolledReadRetryTests` |
| 3 | Market store: single owner of snapshot state as `StateFlow`; applies quote policy; poll loop per A2 policy; forced refresh; revokes current quotes on background, offline and failure; downgrades on a local timer at `validUntilEpoch` | Tests with a virtual clock port `MarketTwoPhaseAndCacheTests`, `QuoteRecoveryTests`, `MarketConnectivityMonitorTests` |
| 4 | Realtime: join `market:prices`, on `quotes` wait 0–10 s jitter then refresh (skip if `etag` already held); polling stays as watchdog; join only while foregrounded | Test ports `QuoteAnnouncementTests`; a dropped socket does not stop polling |
| 5 | Caches: last snapshot (max age 24 h; expired current prices and session statistics stripped, dated closes kept), cleared on sign-out where account-scoped | Tests port `CachePerformanceTests` (behaviour), `StartupLoadingTests` |
| 6 | Detail reads used later: daily history (paged, 1000-row cap), pulse history, issuers, dividends, reports, market rates | Tests port `MarketHistoryPaginationTests`, `MarketHistoryFreshnessTests` |
| 7 | Connectivity monitor and global error presenter (one toast, de-duplicated per operation, grouped retry) wired to the A1 toast host | Tests port `ErrorRecoveryTests` |
| 8 | App availability gate: PostHog `/flags` call for `android-force-update` (payload `{"minimum_version"}`) and `android-maintenance` (+ `-development` variants), 300 s refresh, 3600 s cache, fail-open; snapshot `control.maintenance` slows polling only | Tests port `AppUpdatePolicyTests`; blocking screens exist with Play Store link |
| 9 | Telemetry: PostHog with installation id, never identified, allow-list sanitiser (`platform: "android"`), error limiter 20/h and 1 per (category, domain) per 60 s; Sentry with PII off | Tests port `TelemetryPrivacyTests`; an event outside the allow-list is dropped |
| 10 | Demo fixtures: record one production `market-snapshot` and derive scenarios `open`, `closed`, `stale`, `empty`, `partial`, `offline` | `demo` build starts in any scenario via intent extra |

**How to test.** `./gradlew :data:test`. Manual on emulator with the local stack: start with market "open" in the seed → status and quotes appear; enable airplane mode → offline banner and `Preço por confirmar` within one tick; restore → quotes return; background for 3 minutes and return → prices show unconfirmed until the refresh lands.

**Exit criteria**
- [ ] The fallback rule "never both routes in one refresh" is covered by a test.
- [ ] No request is retried automatically outside the poll loop (asserted with MockWebServer request counts).
- [ ] Telemetry test proves no user id, instrument id or amount can leave the device.
- [ ] Manual offline/background checks recorded with screenshots.

**Prompt**

```text
Phase A3 — data layer and market store (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A3", docs/reference/backend-contract.md sections 3, 8, 9.1 and 13, docs/reference/ios-platform.md sections 3.0, 3.1, 5, 6, 9 and 10, and docs/reference/live-facts.md.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Networking, Core/Market (Data, Store), Core/Telemetry, Core/FeatureFlags, Features/AppAvailability, plus the test files named in section A3.

Implement every task of A3 in :data (and thin wiring in :app). The Realtime channel visibility (public or private) is whatever live-facts.md records; if it is still unconfirmed, join the way the iOS client does and make the choice a single constant.

Constraints: one market store for the whole process. No automatic retries outside the poll loop. Check the session user after every suspension before applying results. Never render prices from the Realtime payload. Record the production snapshot fixture with a single public GET and strip nothing from it.

Verify: ./gradlew :data:test :domain:test, then the manual checks in "How to test" against the local stack from backend phase B0. Tick the exit criteria in the PR with evidence. Finish per AGENTS.md.
```

### A4 — Authentication, onboarding, app shell

**Goal.** A person can install, sign in, set up and land in the five-tab shell; routes survive the journey.

**Source of truth.** Product §1, §2.14–2.16; platform §4, §11.1; contract §1, §12.1; iOS `App/`, `Features/Authentication`, `Features/Onboarding`.

| # | Task | Done when |
|---|---|---|
| 1 | Root state machine of product §1.1 (availability gate → splash → introduction → restore failure → authentication → account setup → shell) with cross-fades | Unit test on the reducer covers all seven states in priority order (ports `SessionRestorationTests`, `LaunchSplashStateTests`) |
| 2 | Introduction: three pages (market, watchlist, portfolio), skip and complete, telemetry `onboarding_started` / `onboarding_step_viewed` / `onboarding_completed` | Shown once per device; events carry only the allowed properties |
| 3 | Google sign-in with Credential Manager → `signInWithIdToken`; nonce handled | Signs in on an emulator with Play services; cancel returns to the screen without an error |
| 4 | Apple sign-in through Supabase OAuth in a Custom Tab, redirect `investao://auth/callback` | Returns to the app signed in; back press cancels cleanly |
| 5 | Debug-only email/password sign-in in the `development` flavor for the B0 accounts | Not compiled into `production` (verified by inspecting the release APK's classes/strings) |
| 6 | Session restore, expiry handling with a single re-auth transition, sign-out cleanup in the iOS order (unregister device, clear market/alerts/portfolio/wrap/intelligence/personalisation/activity caches) | Tests port `AuthenticationStoreTests`; after sign-out no account-scoped file remains |
| 7 | Post-login setup: optional name, first-watchlist picker with search and category chips, resumable draft | Tests port `PostLoginOnboardingTests`; killing the app mid-setup resumes at the same step |
| 8 | Shell: bottom navigation Início · Explorar · Carteira · Lista · Pesquisa with the custom icons, one back stack per tab, bar hidden on pushed details; placeholders for unbuilt tabs | Tab state survives rotation and process death |
| 9 | Pending route holder: `investao://market`, `watchlist`, `portfolio`, `security?id=`, `wrap/weekly-YYYY-MM-DD` parsed with the iOS validation rules and delivered after launch, onboarding and sign-in | Tests port the deep-link parser cases; `adb shell am start -d` for each URL lands on the right destination from a cold start and from signed-out |
| 10 | Screen-view telemetry for tab changes with the allowed screen names | Verified in the PostHog debug log of a `development` build |

**How to test.** JVM tests for 1, 6, 7, 9. Maestro flow `onboarding.yaml` on the `demo` flavor: introduction → fake sign-in → setup → Home. Manual on `development` against the local stack: sign in as `free@…`, kill and relaunch (restored), sign out (returns to authentication, caches gone), each deep link via `adb`.

**Exit criteria**
- [ ] All five deep links work cold, warm and signed-out (evidence: `adb` commands + screenshots).
- [ ] Release APK contains no debug sign-in.
- [ ] Sign-out leaves no account data on disk (list the files checked).
- [ ] Maestro onboarding flow passes.

**Prompt**

```text
Phase A4 — authentication, onboarding and app shell (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A4", docs/reference/ios-product.md sections 1 and 2.14–2.16, docs/reference/ios-platform.md sections 4 and 11.1, and docs/reference/backend-contract.md sections 1 and 12.1.
iOS source (read-only): ../.reference/ios/Invest.AO/App, Features/Authentication, Features/Onboarding, Core/Widgets/WidgetDeepLink.swift, Features/WeeklyWrap/Data/WeeklyWrapDeepLink.swift, and tests AuthenticationStoreTests, SessionRestorationTests, PostLoginOnboardingTests, LaunchSplashStateTests.

Implement every task of A4. Copy is the iOS copy from the string resources generated in A1.

Constraints: no anonymous sessions. Email sign-up does not exist in the product; the debug password sign-in is development-flavor only and must be absent from release builds. Google must use the web client id as the server client id so the account matches iOS. Clear caches on sign-out in the documented order.

Verify: JVM tests, the Maestro flow, and the manual checks in "How to test" against the local stack. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A5 — Home, Explore, Search

**Goal.** The market can be browsed end to end.

**Source of truth.** Product §2.1–2.3, §2.6; iOS `Features/Home`, `Features/Markets`, `Features/Search`.

| # | Task | Done when |
|---|---|---|
| 1 | Home toolbar: profile initials, unusual-activity icon, bell with unread state (no count) | TalkBack reads `Perfil de {nome}`, `Há atividade nova` / `Sem atividade nova` |
| 2 | Home sections in order: market overview card (indicator value, change badge, closing reference label, 30-point sparkline, session volume and trades, fallbacks when unverified), watchlist rail (≤ 6, saved order, empty call-to-action), context slot (empty placeholder until A13), movement feed tabs Subidas/Descidas/Volume (top 3 with usable current quote, both empty copies), news (≤ 3, placeholder until A12), market updates (≤ 3), recap menu (placeholder until A14), simulator entry | Demo scenarios `open`, `closed`, `partial`, `empty` match the states table in §2.1 |
| 3 | Market session sheet: hero, status pill, 44 sp value, change, chart with range picker (`1D` disabled with zero trades, `Tudo` gated), metrics strip, no-index variant, indicator explanation sheet with the legal text | Range gating follows A2 rules; legal text is verbatim |
| 4 | Home states: first-load skeleton, cache-first with dated closes, failure with retry, refresh-failure toast with content kept, offline banner, pull to refresh | Each state reachable in `demo` and screenshotted |
| 5 | Explore: title, search entry, category picker (tab opens on Ações; pushed variant on Todos), result count, sort key menu and direction toggle with haptic, list, session data disclosure, links to News / Learn / market information, both empty states with `Limpar filtros` | Sorting and filtering use A2 logic only; matured bonds hidden |
| 6 | Explore two-pane layout at expanded width (list 300–440 dp + detail, first result auto-selected) | Works on a tablet/foldable emulator |
| 7 | Search: idle screen (heading, field, category cards with real counts, recents ≤ 8 stored on device and clearable, highest volume top 6), results grouped by kind, star toggle in the row, empty copy | Recents persist across restarts and clear on request |
| 8 | Star toggle wiring is optimistic with rollback; the 4th add on an enforced Free account surfaces a typed limit (paywall arrives in A15; until then a neutral dialog) | Verified against the local stack with enforcement on |

**How to test.** Roborazzi screenshots of Home in four scenarios × light/dark. Compose UI test: Explore sort by `Preço` ascending puts missing prices last. Manual against the local stack as `plus@…`: pull to refresh, change category/sort, search "bai", star an instrument and see it on the Home rail.

**Exit criteria**
- [ ] Home never shows a price for an instrument without a usable quote in the `stale` scenario — rows read `Preço por confirmar`.
- [ ] Movement feed shows exactly three rows or the correct empty copy.
- [ ] Font scale 2.0: overview header and asset rows restack without truncating values.
- [ ] Explore and Search pass a TalkBack sweep (rows are single elements with the hint `Abre os detalhes do título`).

**Prompt**

```text
Phase A5 — Home, Explore, Search (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A5", and docs/reference/ios-product.md sections 2.1, 2.2, 2.3 and 2.6.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Home, Features/Markets, Features/Search, docs/LAYOUT_REDESIGN.md, docs/home-context-priority.md.

Implement every task of A5 using only A1 components, A2 rules and the A3 market store. Sections that depend on later phases (context slot, news, recap menu) are built as slots with their real empty state so later phases only supply data.

Constraints: one card on Home (the overview); everything else sits on the canvas. No greeting header. No numeric badge on the bell. Never compute market status or quote validity in a composable — read it from the store. Sorting and search logic must not be re-implemented in the UI layer.

Verify: screenshot tests, the Compose UI test, and the manual checks in "How to test". Tick exit criteria with screenshots. Finish per AGENTS.md.
```

### A6 — Instrument detail

**Goal.** The price-first detail screen with charts, order book, issuer information, comparison and the bond tools.

**Source of truth.** Product §2.7 (all sub-sections), §3.8; contract §3.4–3.7, §3.9, §7.3; iOS `Features/AssetDetails`, `Core/Charts`, `Core/Market/Domain/Models/BondYield.swift`, `Core/Market/Domain/LiquidityProfile.swift`.

| # | Task | Done when |
|---|---|---|
| 1 | Chart component: line + 10 % area, linear interpolation, direction colour, trailing Y axis with compact labels, pinned endpoints, scrub to the nearest real observation with haptic and header update "vs range start", shimmer loading, in-place empty/failed, accessibility summary | Tests port `ChartScrubbingTests`; scrubbing never shows an interpolated value |
| 2 | Header: symbol/name, price with source-aware label (`Cotação BODIVA`, `Referência BODIVA`, `Último fecho verificado · {data}`, `Última cotação BODIVA`), change, status; explicit reason text when unconfirmed | All eight unavailability reasons of §2.6 render their sentence |
| 3 | Ranges 1D–Tudo: intraday via `get_intraday_chart` (statuses ready / no_trades / stale / observed, single-point case), daily via `price_history`; `Tudo` gated to Plus | Tests port `IntradayMovementTests`, `AssetDetailsLogicTests` |
| 4 | Tabs Overview / About / Orders with every section of §2.7: performance, statistics, market info, issuer, dividends, financial reports, liquidity (Plus), bond facts | Checklist of §2.7 sections attached to the PR, each ticked |
| 5 | Order book: 5 levels (all for Pro), refresh every 60 s while visible, hidden as "current" when book quality is not valid | Tests port `OrderBookLevelTests` |
| 6 | Bond yield-to-maturity calculator sheet | Tests port `BondYieldTests` to the last digit |
| 7 | Comparison sheet: up to 3 instruments as % change from a common start, colours accent/orange/purple, `authorize_chart_comparison` with Free limits and the "allowance not used" message, share as PNG | Tests port `ChartComparisonMathTests` |
| 8 | Toolbar: share text in the iOS format, export history CSV (`invest-ao-{symbol}-historico.csv`, Plus), follow star with permission prompt hook (prompt itself in A8) | CSV bytes equal the iOS exporter for the same input (ported `PriceHistoryCSV` test) |
| 9 | Bottom action bar: Comparar + alert button with the three title states (alert sheet arrives in A7) | Bar stays above the navigation inset; stacks at large font scale |
| 10 | Pre-admission listing page from `market_events` | Demo scenario `listing` shows upcoming → confirmed phases |
| 11 | External links (issuer site, reports, sources) open in Custom Tabs; only `https` URLs pass | A non-https URL in fixtures is not tappable |

**How to test.** `:domain:test` for the maths. Screenshot tests of the detail in `open`, `closed`, `stale`, bond and listing scenarios. Manual against the local stack as `free@…` with enforcement on: `Tudo` and CSV export are gated, a third comparison instrument is refused, a second pair in the same week is refused while re-opening the first pair works; as `pro@…` the book shows more than five levels.

**Exit criteria**
- [ ] §2.7 section checklist fully ticked.
- [ ] Bond prices render as % of par with p.p. changes everywhere on the screen.
- [ ] Yield, comparison and CSV outputs match iOS test vectors.
- [ ] Signed-in gating behaves as listed for free, plus and pro seed accounts.

**Prompt**

```text
Phase A6 — instrument detail (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A6", docs/reference/ios-product.md sections 2.7 and 3.8, and docs/reference/backend-contract.md sections 3.4–3.7, 3.9 and 7.3.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/AssetDetails, Core/Charts, Core/Market/Domain/Models/BondYield.swift, Core/Market/Domain/LiquidityProfile.swift, and tests BondYieldTests, LiquidityProfileTests, ChartComparisonMathTests, ChartScrubbingTests, AssetDetailsLogicTests, OrderBookLevelTests, IntradayMovementTests.

Implement every task of A6. Build the chart as one reusable component in :designsystem; later phases reuse it for the index, portfolio and simulator. Before coding, write the section checklist for product §2.7 into the PR description and tick it as you go.

Constraints: pure maths in :domain with ported tests. History older than a year may simply be absent for Free accounts — charts must handle short series without error. The comparison quota is the server's: call authorize_chart_comparison and map its errors; never count locally.

Verify: tests, screenshots, and the manual tier checks in "How to test" against the local stack. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A7 — Watchlist and alerts

**Goal.** Follow instruments, organise them, and set price rules.

**Source of truth.** Product §2.9, §2.C2; contract §4.1–4.3, §4.5, §7.4; iOS `Features/Watchlist`, `Features/Alerts`, `Core/Market/Domain/Policies/WatchlistOrdering.swift`.

| # | Task | Done when |
|---|---|---|
| 1 | Watchlist tab: states of §2.C2.1, pinned header, rows, pull to refresh, pushed variant from Home | All states reachable in `demo` |
| 2 | Add sheet with search; remove with undo; drag reorder through `reorder_watchlist` (reload on "membership changed") | Tests port `WatchlistLogicTests`, `WatchlistStoreTests`, `WatchlistUndoTests` |
| 3 | Row actions (swipe and long-press menu): alerts, movement toggle, remove | Every swipe action has a non-gesture alternative |
| 4 | Groups (Plus): create, rename, delete, add/remove members, filter by group; limits `PLUS_REQUIRED` and `WATCHLIST_GROUP_LIMIT` mapped | Verified against the local stack for free and plus accounts |
| 5 | Free-plan selection screen: choose 3 active + 1 movement instrument via `select_free_watchlist`; others show `Pausado` | With enforcement on and 5 saved items, the screen saves and the server's `active_watchlist_ids` drive the UI |
| 6 | Alerts sheet for an instrument: list, pause, delete; editor for the eight rule kinds with threshold validation (`high_52w`/`low_52w` = 1, volume multiple 1.5–20, days without trades 1–365) | Tests port `MarketAlertsStoreTests`, `MarketAlertsLoadRaceTests`; the server rejects nothing the editor accepts |
| 7 | Automatic movement alerts per watched instrument and sensitivity Low/Normal/High (`user_movement_preferences`) | Free account: enabling a second instrument maps `FREE_MOVEMENT_LIMIT` |
| 8 | Alert saved feedback: success haptic, sound, accessibility announcement | Present and disabled when the system is silent |
| 9 | Writes are idempotent (client-generated ids, upsert-ignore-duplicates) and optimistic with rollback and one global error toast | A repeated save after a simulated timeout creates one row |

**How to test.** `:domain`/`:data` tests. Maestro flow `watchlist.yaml` on `demo`: add, reorder, remove, undo. Manual against the local stack: as `free@…` with enforcement on, hit each limit (4th instrument, 3rd alert rule, 2nd movement instrument, group creation) and confirm the right message; as `plus@…` create a group and 3 rules.

**Exit criteria**
- [ ] Each of the eight rule kinds can be created, paused, edited and deleted against the local stack.
- [ ] Every server limit maps to its own user-facing reason, none to a generic error.
- [ ] Reorder survives a concurrent change (reload-and-retry path exercised in a test).
- [ ] Thresholds are hidden in privacy mode (hook present; mode arrives in A10).

**Prompt**

```text
Phase A7 — watchlist and alerts (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A7", docs/reference/ios-product.md sections 2.9 and 2.C2, and docs/reference/backend-contract.md sections 4.1, 4.2, 4.3, 4.5 and 7.4.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Watchlist, Features/Alerts, Core/Market/Domain/Policies/WatchlistOrdering.swift, Features/Subscriptions (FreePlanSelectionView only), and tests WatchlistLogicTests, WatchlistStoreTests, WatchlistUndoTests, MarketAlertsStoreTests, MarketAlertsLoadRaceTests.

Implement every task of A7. Limits are discovered from server errors, not counted on the device; map each P0001 message and its details.feature to a typed reason that A15 will route to the paywall.

Constraints: direct table writes under RLS exactly as the contract describes; update only the columns the contract allows. Client-generated UUIDs for rules. Watchlist insights ("Leitura da semana") are out of scope here — leave the slot for A13.

Verify: tests, the Maestro flow, and the manual limit checks against the local stack with enforcement on. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A8 — Notifications and Activity centre

**Goal.** Push arrives, is private by default, opens the right screen, and everything is kept in the inbox. Needs AB1.

**Source of truth.** Product §2.13, §7.5; platform §7; contract §4.4–4.6, §9.2, §10; iOS `Core/Notifications`, `Features/Notifications`, `Core/Intelligence/ActivityPolicy.swift`.

| # | Task | Done when |
|---|---|---|
| 1 | FCM client: token fetch/refresh, `register-device` with `platform: android`, `applicationId`, `environment`, versions, `notificationsEnabled`, all capability flags true, payload version 2, `notificationLanguage` = app language; called on launch, token change, sign-in, permission change; `unregister-device` before sign-out | Tests port `PushNotificationRegistrarTests`; a device row appears on the local stack |
| 2 | Android 13+ permission asked in context only: after the first watchlist add, after saving an alert, from Settings, when enabling income reminders. Never on first launch | Fresh install reaches Home without a prompt |
| 3 | Channels mirroring the settings groups: price alerts, automatic movements, daily close, articles and recaps, portfolio, new listings, unusual activity, Weekly Wrap, reminders | Channels visible in system settings with pt/en names |
| 4 | Data-message handling: strict key allow-list for schema 2, drop when `user_id` ≠ signed-in user, build the notification from server `title`/`body`, generic copy for private categories, foreground shows a banner and keeps it in the list | Tests port `NotificationDeliveryMappingTests`, `NotificationPresentationClaimTests`; a payload with an unknown key is rejected |
| 5 | Tap routing through the pending-route holder: fetch the account notification and route by content (wrap, portfolio insight, unusual digest, article, instrument, none), legacy keys supported | Each category opens the destination in the product §1.4 table |
| 6 | Silent refresh message `{"kind":"refresh","security_ids":[…]}` triggers a bounded background snapshot refresh | Verified with a locally sent data message |
| 7 | Activity centre: inbox from `get_account_notifications` (keyset paging) merged with explicit-alert deliveries (de-duplicated per rule and quote), filters, grouping, read state via `acknowledge_account_notifications`, retention 56 days / 200 items locally, privacy-mode masking hook | Tests port `ActivityCenterTests`, `NotificationFactTests`, `DailyCloseCopyTests` |
| 8 | Notification settings: toggles for watched movements, held-asset movements, portfolio daily, listings, public previews, daily close (default off), market recap (RPC), unusual-activity master + seven rules, sensitivity; the line `Até cinco avisos opcionais por dia. Entre as 20h e as 8h, o radar fica em silêncio.` | Each toggle round-trips to its table/RPC on the local stack |
| 9 | Bell unread state on Home re-evaluated every 60 s | Reading all items clears it |

**How to test.** JVM tests. Against the local stack with AB1 merged and FCM pointed at the Firebase test project: as `plus@…`, create a price rule already satisfied by the seed, run `process-notifications`; the notification shows generic text on the lock screen, the tap opens the instrument, the inbox row is marked opened. Repeat for an asset movement with public previews on and off.

**Exit criteria**
- [ ] Lock-screen text is generic for explicit alerts and `portfolio_daily` in every case.
- [ ] A push for another account is dropped (test + manual).
- [ ] Every category in contract §4.4 routes correctly or deliberately does nothing.
- [ ] Preferences changed on Android are visible to the iOS app (same tables) — owner cross-check noted in the PR.

**Prompt**

```text
Phase A8 — notifications and Activity centre (invest.ao Android).

Precondition: backend phase AB1 is merged and deployed to the environment you test against. If not, stop.

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A8", docs/reference/ios-product.md sections 2.13 and 7.5, docs/reference/ios-platform.md section 7, and docs/reference/backend-contract.md sections 4.4, 4.5, 4.6, 9.2 and 10.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Notifications, Features/Notifications, Core/Intelligence/ActivityPolicy.swift, ActivityArchive.swift, and tests PushNotificationRegistrarTests, NotificationDeliveryMappingTests, NotificationPresentationClaimTests, ActivityCenterTests, NotificationFactTests, DailyCloseCopyTests.

Implement every task of A8. Register notificationLanguage so the server renders text; do not add loc-key resources. Render inbox rows from the server composition (title, body, accessibilityText); local voice composition is not part of this phase.

Constraints: data-only messages; the app builds the system notification. Validate payload keys strictly and fail closed. Never place amounts, thresholds or the user's relationship to an instrument in a system notification. No permission prompt before a contextual trigger.

Verify: tests, then the manual push checks in "How to test". Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A9 — Profile, settings, account deletion

**Goal.** The account can be managed and deleted from the app, which closes the Core milestone.

**Source of truth.** Product §2.17, §5; platform §4.4–4.5; contract §1.5, §4.7; iOS `Features/Profile`, `Features/Settings`, `Core/Reviews`.

| # | Task | Done when |
|---|---|---|
| 1 | Profile sheet: identity card, display name edit (`user_profiles`, tolerate a missing row) | Name change shows in the Home initials |
| 2 | Settings rows of §2.17 in order, including appearance (System/Light/Dark), language (per-app locale: pt/en), notifications (A8 screen), data source and disclaimer text, privacy policy link `https://invest.ao/policy`, version | Row list in the PR matches §2.17; each row works or is explicitly marked as arriving in a later phase |
| 3 | Sign out with confirmation | Returns to authentication; A4 cleanup runs |
| 4 | Account deletion: non-Apple accounts via `delete_user_account`; Apple-linked via `apple-web-deletion/start` (`returnPlatform: native`) in a Custom Tab and the `investao://…?status=` return; session cleared only on `deleted` and confirmed with the server; copy states that store subscriptions are not cancelled | Tests port `AccountDeletionRepositoryTests`, `AccountDeletionStoreTests`, `AccountDeletionLocalDataTests`; a local-stack user is gone after the flow |
| 5 | Personalisation reset controls (`Reiniciar interesses neste dispositivo`, `Repor preferências de utilidade`) wired to stores that A13 fills | Present and harmless before A13 |
| 6 | Play In-App Review policy: 3 completed tasks across 2 sessions, 90-day cooldown, once per version, waits for a quiet window | Tests port `ReviewPromptTests` |
| 7 | App-switcher protection: recents thumbnail hidden for account screens (`FLAG_SECURE` on the activity or a recents cover) | Recents shows no portfolio or watchlist content |

**How to test.** JVM tests. Manual on the local stack: delete a throwaway password user (non-Apple path) and confirm `auth.users` no longer has it; run the Apple path against the stubbed Apple endpoint from AB3 for `deleted`, `cancelled`, `failed`. Change language to English and back; change theme.

**Exit criteria**
- [ ] Deletion clears every local file and leaves no session (list checked paths).
- [ ] `cancelled` and `failed` keep the user signed in with a clear message.
- [ ] Language and theme changes apply without losing navigation state more than a recreate.
- [ ] M1 smoke: a new user can install → sign in → follow → set an alert → receive it → delete the account, all on the local stack.

**Prompt**

```text
Phase A9 — profile, settings, account deletion (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A9", docs/reference/ios-product.md sections 2.17 and 5, docs/reference/ios-platform.md sections 4.4 and 4.5, and docs/reference/backend-contract.md sections 1.5 and 4.7.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Profile, Features/Settings, Core/Reviews, docs/account-deletion.md, docs/contextual-reviews.md, and tests AccountDeletionRepositoryTests, AccountDeletionStoreTests, AccountDeletionLocalDataTests, ReviewPromptTests.

Implement every task of A9. iOS-only rows (Live Activity, widget disclosure) are placed by phase A16; leave their positions noted.

Constraints: an Apple-linked account must never call delete_user_account (the server refuses it) — detect the Apple identity and use the browser path. Clear local data only after the server confirms deletion. Deletion and sign-out copy is the iOS copy.

Verify: tests and the manual checks in "How to test", then run the M1 smoke end to end and record it in the PR. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A10 — Portfolio core and privacy mode

**Goal.** A manual ledger with correct maths, dashboard and privacy mode.

**Source of truth.** Product §2.C1.1–2.C1.7, §2.C1.12, §2.C1.16, §5.1; platform §12.1; contract §5.1; fixture `portfolio-ledger.v1.json`; iOS `Features/Portfolio`, `Core/Privacy`.

| # | Task | Done when |
|---|---|---|
| 1 | Ledger calculator in `:domain` (weighted average cost, fees, income, bond scale 0.01, oversell invalidates the whole ledger, results by year, allocations only when every position is priced, historical value series) | `portfolio-ledger.v1.json` passes unchanged — all 8 golden cases; tests port `PortfolioCalculatorTests` |
| 2 | Ledger repository: `get_portfolio_ledger_page` (500-row keyset, revision, `PT409` → restart), direct inserts/updates/deletes with client ids, civil dates | Tests port `PortfolioLedgerContractTests`, `PortfolioIdempotentSaveTests`, `PortfolioCivilDateTests`, `PortfolioRefreshTests` |
| 3 | Tab states and pinned header; dashboard sections in the §2.C1.3 order: value, period change, value chart with ranges, positions, allocation, summary; `Valor parcial` / `Valor indisponível` when quotes are missing | Demo scenarios `full`, `partial`, `empty`, `invalid ledger` match the spec |
| 4 | Records list, position detail (average cost, realised/unrealised), transaction editor for buy/sell/income with all server validations mirrored and server errors mapped | Every rule in contract §5.1's table has a matching inline message |
| 5 | CSV export `invest-ao-carteira.csv` and import with review, same format as iOS | Tests port `PortfolioCSVTests`; a file exported by iOS imports without change (fixture from the iOS tests) |
| 6 | Privacy mode: device-level, off by default, survives sign-out; eye button with first-use explanation; `SensitiveValue` masking per the §5.1 table; holdings sorted by id while hidden; unitless trend chart; applies to alerts thresholds and the Activity centre | Tests port `PrivacyModeTests`; screenshots of the dashboard hidden vs shown |
| 7 | Foreground reload every 60 s; valuation only from current quotes | In the `stale` scenario the dashboard shows `Valor indisponível`, never a value from a closing reference |

**How to test.** `:domain:test` (golden fixture first). Screenshot tests for the dashboard states × privacy. Manual on the local stack as `plus@…`: add a buy, a sell that would oversell (refused with the right message), an income entry, edit and delete; export CSV, wipe, import.

**Exit criteria**
- [ ] All 8 golden cases pass with decimals compared as strings.
- [ ] No `Double` anywhere under the portfolio packages (detekt rule or grep in CI).
- [ ] Privacy mode hides every value listed in §5.1 and nothing public.
- [ ] Round trip export → import reproduces the ledger exactly.

**Prompt**

```text
Phase A10 — portfolio core and privacy mode (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A10", docs/reference/ios-product.md sections 2.C1.1–2.C1.7, 2.C1.12, 2.C1.16 and 5.1, docs/reference/ios-platform.md section 12.1, and docs/reference/backend-contract.md section 5.1.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Portfolio (Data and views for dashboard, records, position, editor, transfer), Core/Privacy, Core/Components/SensitiveValue.swift, docs/privacy-mode.md, and tests PortfolioCalculatorTests, PortfolioLedgerContractTests, PortfolioCSVTests, PortfolioCivilDateTests, PortfolioIdempotentSaveTests, PortfolioRefreshTests, PrivacyModeTests.

Start with the calculator and make domain/src/test/resources/fixtures/portfolio-ledger.v1.json pass unchanged before any UI. Then implement the remaining tasks of A10.

Constraints: BigDecimal with explicit scale and rounding identical to the fixture expectations; compare as strings in tests. Trade dates are LocalDate in Africa/Luanda and never later than today there. A closing reference never values a position. Books, cash, benchmark, income calendar, statement reader and share links are phase A11 — leave their entry points out.

Verify: tests, screenshots, and the manual ledger checks in "How to test". Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A11 — Portfolio, advanced

**Goal.** The Plus and Pro portfolio features.

**Source of truth.** Product §2.C1.8–2.C1.11, §2.C1.13, §2.C1.15, §2.C1.17; contract §5.2–5.4; platform §12.1; iOS `Features/Portfolio/Data/{PortfolioCash,PortfolioBooks,PortfolioBenchmark,PortfolioResults,IncomeCalendar,StatementTextParser,PortfolioShares}.swift`.

| # | Task | Done when |
|---|---|---|
| 1 | Named portfolios: menu, create/rename/delete (cascade warning), per-portfolio calculation; limits `PLUS_REQUIRED`, `PORTFOLIO_LIMIT` (9 named + main) | Verified on the local stack for free and plus accounts |
| 2 | Cash movements (deposit, withdrawal, fee), balance and total result formulas of platform §12.1 | Unit tests reproduce the iOS cash cases |
| 3 | Benchmark against inflation and rates (`market_rates`: `Inflação Homóloga`, `Taxa Básica do BNA`, `Taxa LUIBOR Overnight`, `BTs - 364 Dias`) with continuous compounding | Unit tests reproduce the iOS benchmark cases |
| 4 | Results by year and the yearly report export as PDF (per instrument: realised, net income, withheld tax, commissions) | PDF opens in a viewer; totals equal the calculator's |
| 5 | Income calendar; totals (Plus); payment-day reminders at 09:00 Luanda as local notifications scheduled with WorkManager/AlarmManager (Plus) | A reminder for a seeded dividend fires at the expected instant on an emulator with the clock moved |
| 6 | Statement reader (Plus): photo or PDF → on-device text recognition (ML Kit) → `StatementTextParser` port → review screen feeding the import flow | Parser tests port the iOS cases; a sample statement image produces reviewable rows |
| 7 | Read-only share links (Pro): `create_portfolio_share` (token shown once), list with explicit columns, revoke, share URL `https://invest.ao/partilha/{token}`; limits `PRO_REQUIRED`, `SHARE_LIMIT` (20) | Created link resolves through `get_shared_portfolio` on the local stack; revoke makes it return null |
| 8 | Gating summary of §2.C1.17 applied through typed limit reasons | Table in the PR, one row per gate, each verified |

**How to test.** `:domain:test`. Manual on the local stack with enforcement on across the three seed accounts for every gate in task 8. PDF and reminder checks on an emulator.

**Exit criteria**
- [ ] Every gate in §2.C1.17 behaves correctly for free, plus and pro.
- [ ] Cash and benchmark maths match iOS test vectors.
- [ ] The share token is never logged, cached or shown again after creation.
- [ ] Statement images are processed on the device only (no network call during recognition).

**Prompt**

```text
Phase A11 — portfolio, advanced (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A11", docs/reference/ios-product.md sections 2.C1.8–2.C1.11, 2.C1.13, 2.C1.15 and 2.C1.17, docs/reference/ios-platform.md section 12.1, and docs/reference/backend-contract.md sections 5.2, 5.3 and 5.4.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/Portfolio (Data/PortfolioCash, PortfolioBooks, PortfolioBenchmark, PortfolioResults, IncomeCalendar, IncomeReminderScheduler, StatementTextParser, PortfolioShares, PortfolioYearReport and their views) with the matching tests.

Implement every task of A11. Maths goes in :domain with the iOS test vectors ported.

Constraints: request portfolio_shares with explicit columns (select=* fails). Treat the share token as a bearer secret. Text recognition must run on-device. Reminders are local notifications in the "reminders" channel from A8.

Verify: tests and the manual gate matrix in "How to test". Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A12 — Content: news, market information, Learn, unusual activity, week ahead, simulator

**Goal.** The reading and exploring surfaces.

**Source of truth.** Product §2.4, §2.5, §2.8, §2.11, §2.12; contract §3.10, §3.11; platform §12.2; iOS `Features/{News,Learn,UnusualActivity,WeekAhead,Simulation}`.

| # | Task | Done when |
|---|---|---|
| 1 | News: Home/market-information section (≤ 3), archive with paging and search, article detail with Markdown subset (safe URLs only), sources, related instruments, story-image share | Tests port `NewsFeedTests`, `NewsMarkdownTests`, `NewsStoryContentTests`, `HomeNewsContractTests` |
| 2 | Market information screen with category chips and update detail | Tests port `MarketInformationTests` |
| 3 | Learn: the seven bundled lessons with read state | Lesson content equals the iOS bundle (string resources) |
| 4 | Unusual activity: grouped by instrument, watchlist section first, shares before bonds, signal lines per rule with the wording table, withdrawn orders struck through, disclaimer footer, notification controls sheet | Tests port `UnusualActivityTests`; all nine rules render from fixtures |
| 5 | Week ahead: period rule (next Monday–Friday in Luanda), day sections, event rows with status and source, relationship badges, cached-batch banner, about section, all three states | Tests port `WeekAheadTests` |
| 6 | Simulator: gate states, projection chart, controls and presets, methodology and disclaimers; generic and instrument modes; draft persistence | Tests port `InvestmentSimulationTests`, `AssetInvestmentSimulationTests`, `SimulationDraftTests` with identical outputs |
| 7 | Wire Home news and market-update slots and the Explore links from A5 | Home shows real publications |

**How to test.** `:domain:test`. Screenshots of each screen in content/empty/error. Manual: open an article with external links (Custom Tab), mark a lesson read, run the simulator with the iOS preset values and compare the final balance to the iOS test vector.

**Exit criteria**
- [ ] Simulator outputs equal iOS vectors to the last displayed digit.
- [ ] Markdown renderer refuses non-https and script-bearing links (test).
- [ ] The unusual-activity disclaimer and the simulator disclaimer are verbatim.
- [ ] Week ahead shows no event when the calendar is unverified.

**Prompt**

```text
Phase A12 — content screens (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A12", docs/reference/ios-product.md sections 2.4, 2.5, 2.8, 2.11 and 2.12, docs/reference/ios-platform.md section 12.2, and docs/reference/backend-contract.md sections 3.10 and 3.11.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/News, Features/Learn, Features/UnusualActivity, Features/WeekAhead, Features/Simulation, Core/Intelligence/WeekAheadPolicy.swift, docs/investment-simulator.md, docs/week-ahead-phase7.md, docs/editorial-news.md, and the test files named in section A12.

Implement every task of A12. The simulator's monthly growth factor must follow the documented formula (log1p/expm1 in double precision, converted through the shortest decimal string) so results match iOS.

Constraints: articles are Portuguese as authored — never machine-translate. No forecasts or advice wording anywhere. Simulator maths in :domain with BigDecimal (MathContext of 38 digits).

Verify: tests, screenshots, and the manual checks in "How to test". Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A13 — Intelligence, personalisation, product voice

**Goal.** Verified facts become insights on Watchlist, Portfolio, Home and the Activity centre, ordered by the shared ranking engine.

**Source of truth.** Product §2.1 (context slot, Discover), §2.C1.14, §2.C2.9, §2.C3, §5.2; platform §9.5–9.6, §12.3–12.5; contract §3.12, §4.8, §4.9; fixtures `parity.v1.json`, `catalogue.v1.json`, `intelligence-feature-config.example.json`; iOS `Core/Intelligence`, `Core/Personalisation`, `Core/ProductVoice`.

| # | Task | Done when |
|---|---|---|
| 1 | Feature controls: decode `intelligence_feature_configuration`, FNV-1a rollout bucket, audiences (`production` release, `internal` debug), dependency rules, expiry → optional features off | Fixture `fixture-install\|weekly_wrap\|phase19` → bucket 8065; tests port `IntelligenceFeatureControlTests` |
| 2 | Evidence and validation: `get_market_period_evidence`, freshness policy (fetch < 15 min, period ended < 7 days), series validator, portfolio input validator | Tests port `InsightFoundationTests` |
| 3 | Insight generators: 5 watchlist and 9 portfolio insight types with the documented significance constants | Tests port `WatchlistIntelligenceTests`, `PortfolioIntelligenceTests` |
| 4 | Product voice: ship `catalogue.v1.json` byte-identical (checksum test), deterministic composition, English through string resources, recent-choice memory | `parity.v1.json` passes unchanged; tests port `ProductVoiceTests` |
| 5 | Personalisation: activity events → daily counters synced via `user_activity_daily`, interest profile, ranking engine v1/v2/significance, exposure receipts (56 days), feedback | Tests port `PersonalisationTests`, `PersonalizationEngineTests` |
| 6 | Cache with lease, invalidation on ledger/watchlist/market fingerprint change, 7-day expiry (24 h week ahead), "saved" labels | Tests port `IntelligenceCacheTests` |
| 7 | Surfaces: Watchlist "Leitura da semana" with dismiss / not useful; Portfolio weekly reading tiles with explanation sheets; Activity centre merge of local insights; Home context slot resolver (Friday Wrap card data hook, Saturday Discover, Sunday Week ahead) and Saturday Discover ranking | Tests port `HomeContextResolverTests`, `SaturdayDiscoverTests`; privacy mode removes personal content |
| 8 | Privacy classes (public market / personal context / private financial) enforced on every surface; nothing from this engine reaches analytics | Tests port `IntelligencePrivacyTests`, `IntelligenceObservabilityTests` |
| 9 | Evaluation harness export comparable with iOS `intelligence-evaluation.json` | Android export equals the iOS export for the shared scenarios (diff attached) |

**How to test.** `:domain:test` is the main gate. Manual in `demo` with the clock set to a Friday after close, a Saturday and a Sunday: the context slot shows the Wrap card, Discover (≤ 5 rows, caps respected), and the Week-ahead offer; with privacy mode on, personal rows disappear.

**Exit criteria**
- [ ] `parity.v1.json` and the catalogue checksum pass.
- [ ] Evaluation export diff against iOS is empty for shared scenarios.
- [ ] No personal monetary amount or holding quantity appears on Home in any scenario.
- [ ] Expired feature configuration turns every optional surface off (test).

**Prompt**

```text
Phase A13 — intelligence, personalisation, product voice (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A13", docs/reference/ios-product.md sections 2.1 (context slot rules, Saturday Discover), 2.C1.14, 2.C2.9, 2.C3 and 5.2, docs/reference/ios-platform.md sections 9.5, 9.6 and 12.3–12.5, and docs/reference/backend-contract.md sections 3.12, 4.8 and 4.9.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Intelligence (all 31 files), Core/Personalisation, Core/ProductVoice, Core/Privacy/IntelligencePrivacy.swift, docs/intelligence-foundation.md, docs/portfolio-insight-catalog.md, docs/watchlist-insight-catalog.md, docs/PERSONALIZATION_DECISIONS.md, and every test file named in section A13. Also ../.reference/ios/scripts/compare-intelligence-evaluations.py.

This is a port, not a redesign: translate file by file into :domain, porting each test file first and making it pass. The reference documents describe this area by architecture only — the Swift source and its tests are the specification, including every weight, threshold and tie-break.

Constraints: all computation on-device for the signed-in user; re-check the user id after every suspension. Evidence comes only from get_market_period_evidence (never chart points) and only is_final rows. The catalogue file is copied, never edited. Privacy mode zeroes interest-based scoring and hides personal and private classes.

Verify: ./gradlew :domain:test, produce the evaluation export and diff it against an iOS export (run `swift test --filter IntelligenceEvaluationTests` in ../.reference/ios if a macOS toolchain is available; otherwise say so and attach the Android export). Then the manual context-slot checks. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A14 — Weekly Wrap

**Goal.** The story-style weekly review with verified data, archive and sharing.

**Source of truth.** Product §2.10; contract §3.8 (wrap windows), §4.9; platform §12.6; iOS `Features/WeeklyWrap`.

| # | Task | Done when |
|---|---|---|
| 1 | Availability from `get_available_market_wraps`, eligibility and entry points (Home context card, recap menu, push, `investao://wrap/…`), expired → `Wrap indisponível` | Tests port `WrapAvailabilityRepositoryTests` |
| 2 | Assembly from `get_weekly_wrap_evidence`: stories opening, market index, breadth, rise, fall, watchlist, watchlist highlight, portfolio, contributor, personal stat, summary; personalised order | Tests port `VerifiedWeeklyWrapTests`, `WeeklyWrapTests` |
| 3 | Player: always dark, tap/hold/swipe navigation, progress segments, resume, completion; +4 s per story at large font scale; reduced-motion fallbacks | UI test steps through all stories and reaches completion |
| 4 | Soundtrack (bundled `weekly-wrap-theme.mp3`) with mute, and haptics | Audio stops on background and respects the mute switch |
| 5 | Data and method sheet (weekly) | Lists observations with provenance |
| 6 | Privacy mode inside the Wrap | Personal and financial stories are skipped |
| 7 | Snapshots and archive; lifecycle activity events (`wrap_available/opened/completed/abandoned/shared`) | Archive opens a past Wrap offline from its snapshot |
| 8 | Sharing: share-card image; MP4 export of the stories (MediaCodec/Media3) | Image share works; video export produces a playable file under 30 s for a 10-story Wrap, or is cut with a recorded reason if the device cannot encode |
| 9 | Wire the Home context card and recap menu | Friday-after-close demo scenario opens the Wrap from Home |

**How to test.** `:domain:test`. Compose UI test for the player. Manual in `demo` (Friday scenario): open from Home, complete, confirm it leaves the context slot but stays in the recap menu; share the card.

**Exit criteria**
- [ ] Only `is_final` evidence rows are used (test).
- [ ] A Wrap for an expired window cannot be opened from any entry point.
- [ ] TalkBack can move through stories with explicit next/previous controls.
- [ ] Privacy mode removes every personal story.

**Prompt**

```text
Phase A14 — Weekly Wrap (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A14", docs/reference/ios-product.md section 2.10, docs/reference/ios-platform.md section 12.6, and docs/reference/backend-contract.md sections 3.8 and 4.9.
iOS source (read-only): ../.reference/ios/Invest.AO/Features/WeeklyWrap (Data and views), docs/weekly-wrap.md, docs/weekly-wrap-phase1.md, and tests VerifiedWeeklyWrapTests, WeeklyWrapTests, WrapAvailabilityRepositoryTests.

Implement every task of A14. Assembly logic goes in :domain with the iOS tests ported; the player is UI only.

Constraints: the Wrap is computed on the device from server evidence; never invent or interpolate a value. Always-dark surface regardless of theme. If MP4 export proves unreliable on the test devices, ship the image share, keep the exporter behind a flag, and say so in the PR — do not block the phase on it.

Verify: tests, the player UI test, and the manual checks in "How to test". Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A15 — Subscriptions

**Goal.** Plus and Pro can be bought, restored and managed; every lock leads to the plans screen and resumes the blocked action. Needs AB2.

**Source of truth.** Product §6; platform §8; contract §7; iOS `Core/Subscriptions`, `Features/Subscriptions`.

| # | Task | Done when |
|---|---|---|
| 1 | RevenueCat configured with app user id = Supabase user id (log in/out with the session), offerings for Plus and Pro, purchase, restore | A licence-tester purchase on an internal-track build completes |
| 2 | Access store: `sync-subscription` after purchase/restore/launch-when-paid, then `get_subscription_access()`; the server snapshot authorises, never the SDK; everything open unless enforcement is on and the build flag is `YES` | Tests port the iOS subscription store cases; rate-limit `BILLING_RATE_LIMIT` handled |
| 3 | Plans screen (always dark, own palette): hero with reason sentence, comparison tables Grátis/Plus and Plus/Pro, membership block, referral block, status lines, support actions, terms and privacy links, "prefer free" disclosure, sticky footer with Anual (preselected, savings pill) / Mensal, trial button copy, renewal summary; prices only from the store | Every element of §6.3 present; no hard-coded price |
| 4 | Lock presentation: every typed limit reason from A6, A7, A10, A11 opens the plans screen with its sentence; after a verified purchase the blocked action resumes once | Matrix of the 17 triggers in §6.4 attached, each verified |
| 5 | Downgrade: nothing deleted; Free selection screen from A7 offered | A lapsed seed account sees paused instruments, not missing ones |
| 6 | Referral: code display and share text with the Play Store link, redeem dialog with all error messages, credit-until line; hidden when referrals are closed | Verified on the local stack |
| 7 | Lifetime gift announcement sheet via `claim_lifetime_plus_announcement` | Shown once |
| 8 | Manage subscription → Play subscriptions page; one-time onboarding offer for Free accounts | Links open the right page |

**How to test.** JVM tests. Local stack: stub RevenueCat as in AB2 to flip `free@…` to Plus and confirm locks open and the blocked action resumes. Internal-track build with a licence tester for a real purchase, trial and cancellation.

**Exit criteria**
- [ ] A purchase on Android is visible as Plus on iOS for the same account (owner cross-check).
- [ ] With enforcement off, no lock appears anywhere.
- [ ] All 17 paywall triggers show their own reason sentence.
- [ ] Purchase cannot be dismissed mid-flight; failure and pending messages match §6.3.

**Prompt**

```text
Phase A15 — subscriptions (invest.ao Android).

Precondition: backend phase AB2 is merged and deployed, and Play products exist. If not, stop.

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A15", docs/reference/ios-product.md section 6, docs/reference/ios-platform.md section 8, and docs/reference/backend-contract.md section 7.
iOS source (read-only): ../.reference/ios/Invest.AO/Core/Subscriptions, Features/Subscriptions, docs/subscription-foundation.md, docs/subscription-release-checklist.md.

Implement every task of A15. Replace the neutral limit dialogs left by earlier phases with the plans screen.

Constraints: the backend snapshot is the only authority for access. Prices, periods and trial eligibility come from the store through RevenueCat. Terms link: the invest.ao terms page if the website has published one, otherwise the Play terms — record which in the PR. Do not offer purchase while signed out.

Verify: tests, the local-stack lock/resume checks, and one real licence-tester purchase. Attach the trigger matrix. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A16 — Widgets and system surfaces

**Goal.** The Android answers to iOS widgets, Live Activity, Spotlight and Shortcuts.

**Source of truth.** Product §7.1–7.4, §7.6; platform §13; iOS `InvestAOWidgets`, `Core/Widgets`, `App/LiveActivity`, `App/Intents`.

| # | Task | Done when |
|---|---|---|
| 1 | Snapshot store written by the app (market, watchlist, portfolio, owner files; pre-formatted strings; ownership check; private files removed on sign-out) | Tests port `WidgetSnapshotTests`, `MarketWidgetCommitTests` |
| 2 | Four Glance widgets — Market, Watchlist, Instrument (configuration activity with a searchable picker), Portfolio — with small/medium/large responsive layouts and the content rules of §7.1 | Each renders populated, stale, empty, private, partial scenarios (screenshots) |
| 3 | Refresh: 30 min when the last session was open/opening, else 2 h (WorkManager); update only when content changed; portfolio downgrade at `currentQuotesValidUntil` | Verified with a debug trigger |
| 4 | Privacy: portfolio values opt-in (`Mostrar valores da carteira nos widgets`, default off); privacy mode masks | Settings row added; default widget shows no values |
| 5 | Session ongoing notification, opt-in from Settings: shows open time before the open, countdown and progress during the session, ends at close; no prices | Starts on a seeded trading day and disappears after close |
| 6 | App shortcuts: Carteira, Lista, Pesquisa (static) and recently viewed instruments (dynamic) | Long-press on the launcher icon lists them |
| 7 | Verified App Links for `https://invest.ao/…` instrument, article, wrap and shared-portfolio URLs (`assetlinks.json` served by the website, phase W4) alongside `investao://` | `adb shell pm get-app-links` shows verified once the site serves the file |

**How to test.** JVM tests for the store. Add each widget on an emulator in each size and scenario. Sign out and confirm private widgets fall back to their hint text.

**Exit criteria**
- [ ] Widgets make no network request and hold no credentials.
- [ ] Missing change renders `Variação indisponível`, never a flat market.
- [ ] Sign-out removes private snapshot files before the session ends.
- [ ] No freshness footer on any widget.

**Prompt**

```text
Phase A16 — widgets and system surfaces (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A16", docs/reference/ios-product.md sections 7.1–7.4 and 7.6, and docs/reference/ios-platform.md section 13.
iOS source (read-only): ../.reference/ios/InvestAOWidgets, Invest.AO/Core/Widgets, App/LiveActivity, App/Intents, App/Spotlight, docs/home-screen-widgets.md, and tests WidgetSnapshotTests, MarketWidgetCommitTests.

Implement every task of A16 in the :widgets module and thin app wiring.

Constraints: widgets read only the snapshot files the app writes. Same wording as iOS for titles, descriptions and hints. The session notification carries no prices and no account data and is off by default.

Verify: tests and the on-device checks in "How to test"; attach screenshots of every widget size in populated and private states. Tick exit criteria with evidence. Finish per AGENTS.md.
```

### A17 — Hardening and release

**Goal.** A build fit for the Play Store.

| # | Task | Done when |
|---|---|---|
| 1 | Accessibility pass on every screen: TalkBack order and labels, 48 dp targets, contrast (including the increased-contrast palette), font scale 2.0, reduced motion | Checklist per screen in `docs/release/accessibility.md` |
| 2 | Performance: cold start, Home first content, list scroll; baseline profile; R8 with verified keep rules for serialization | Cold start to first Home content ≤ 2 s on a mid-range device from cache; no jank frames in the Explore list macrobenchmark |
| 3 | Release configuration: signing by env, `production` flavor only, network security config (HTTPS only), backup rules excluding session and caches, `FLAG_SECURE` decisions reviewed | `bundleProductionRelease` produces an installable AAB |
| 4 | Sentry mapping upload, PostHog production token by name, crash-free smoke | A forced test crash appears de-obfuscated |
| 5 | Play listing in pt-PT from the iOS store copy (product §9), screenshots, data-safety form answers derived from the telemetry allow-list, account-deletion URL (website W10), content rating | `docs/release/play-listing.md` complete |
| 6 | Release checklist and backend ordering rule (backend first) | `docs/release/checklist.md` |
| 7 | Full regression: the M1 smoke plus portfolio, wrap, subscriptions and widgets on a release build against production with the owner's account | Signed-off run recorded |
| 8 | Internal testing track upload | Build visible to testers |

**Exit criteria**
- [ ] No lint error, no detekt issue, all tests green on the release commit.
- [ ] Release APK contains no demo fixtures, debug sign-in or development URLs (inspected and listed).
- [ ] Data-safety answers match what the app can actually send.
- [ ] Owner regression signed off.

**Prompt**

```text
Phase A17 — hardening and release (invest.ao Android).

Read AGENTS.md, docs/plan/ANDROID_IMPLEMENTATION_PLAN.md section "A17", docs/reference/ios-product.md sections 3.10 and 9, and docs/reference/ios-platform.md sections 9 and 15.
iOS references (read-only): ../.reference/ios/APPLE_RELEASE_CHECKLIST.md, fastlane/metadata/pt-PT, docs/app-store-aso.md.

Implement every task of A17. Fix what the audits find; do not add features.

Constraints: you cannot sign, upload or publish — prepare everything and leave the upload and store-console steps as an exact owner checklist. Store copy is Portuguese, adapted from the iOS listing; do not promise real-time data.

Verify with the release build on a physical-profile emulator and attach the audit documents. Tick exit criteria with evidence. Finish per AGENTS.md.
```
