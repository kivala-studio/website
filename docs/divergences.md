# Divergences from the backend and the iOS app

The backend (`investao-functions`, code under `supabase/`) and the iOS app (`invest.ao`, Swift code) are the source of truth. This document lists where the web's code differs. Nothing here is fixed in code.

Web paths are relative to this repository. Backend paths are relative to `investao-functions/supabase/`. iOS paths are relative to `invest.ao/Invest.AO/`.

## Against the backend

| # | Topic | Web | Backend |
|---|---|---|---|
| B1 | Personalisation sync runs without a session | `src/data/personalisation/personalisation.ts` upserts and selects `user_activity_daily` through the browser client. Session cookies are `HttpOnly` (`src/data/auth/cookies.ts`), so page scripts cannot read them and the browser client holds no member session | `user_activity_daily` grants `select, insert, update` to `authenticated` only, with policies for `authenticated` (`migrations/20260924223338_personalisation_activity_aggregates.sql`). Runtime behaviour was not tested |
| B2 | `PLUS_REQUIRED` feature `liquidity_report` | `PLUS_FEATURES` in `src/domain/errors/rules.ts` has no entry for it; an unknown feature maps to the reason `onboarding` | `get_liquidity_report` and `get_spread_history` raise `PLUS_REQUIRED` with `{"feature":"liquidity_report"}` (`migrations/20261118090000_liquidity_unit_value.sql`). The web calls neither RPC (see I6) |
| B3 | Fields of `get_subscription_access()` not read | `decodeSubscriptionAccess` (`src/domain/account/access.ts`) reads `is_plus`, `enforcement_enabled`, `week_start`, `resets_at`, `comparison_pair`, `active_watchlist_ids`, `movement_security_id`, `plus_until`, `store_subscription` | The function also returns `is_pro`, `plus_credit_until` and `lifetime_gift` (`migrations/20261019221309_lifetime_plus_gifts.sql` and later patches) |
| B4 | Lifetime Plus detection | `isLifetimePlus` treats `is_plus` with `plus_until = null` as lifetime (`src/features/billing/plan-status.tsx`) | Lifetime is reported in `lifetime_gift`; `plus_until` is null for a lifetime gift or no Plus |
| B5 | `get_web_order` unused | A single order is read through the `web-order-status` Edge Function only (`src/data/billing/web-passes.ts`) | RPC `get_web_order(order_id)` exists (`migrations/20261122090000_web_plus_passes.sql`) |
| B6 | Referral RPCs unused | No call to `get_referral` or `redeem_referral_code`. The rule codes are mapped (`src/domain/errors/rules.ts`) and `/convite/[code]` stores the code in `sessionStorage` (`src/features/site/invite-keeper.tsx`), but nothing reads it back | Both RPCs exist (`migrations/20261111090000_referral_credit.sql`, `migrations/20261112250000_paid_limits.sql`) |
| B7 | Subscription sync unused | No call to `sync-subscription` or `claim_lifetime_plus_announcement` | Both exist (`functions/sync-subscription`, `migrations/20261019221309_lifetime_plus_gifts.sql`) |
| B8 | Realtime event `trades` unused | Only `quotes` is subscribed (`src/data/market/realtime.ts`) | `market:prices` also carries `trades` (`functions/_shared/intraday_sync.ts`) |
| B9 | Home projection unused | `get_current_market_quotes` is called without the `x-investao-projection` header (`src/data/market/repository.ts`). `src/domain/market/snapshot.ts` contains the projection types | The RPC honours `x-investao-projection: home_v1` (`migrations/20261112230000_market_cache_reads_serve.sql`) |
| B10 | Portfolio count on the Plus page | `/plus` shows Free 1, Plus 10 (`src/app/[locale]/(site)/plus/page.tsx`) | `PORTFOLIO_LIMIT` is raised with `"limit":9` for named portfolios (`migrations/20261109090000_portfolio_books.sql`); the main portfolio is not a row of `portfolios` |
| B11 | Web pass price and gateway | Demo mode uses placeholder prices and reproduces the fake gateway's timing (`src/data/demo/web-pass-ledger.ts`). Copy names Multicaixa Express and pay-by-reference (`src/domain/billing/web-pass.ts`) | `web_products.price_aoa` is null and `active` false in migrations; the only gateway implementation is `fake` (`functions/_shared/payment_gateway.ts`). Live values are set outside the code |
| B12 | Device registration | None; the web has no push channel | `register-device`, `unregister-device` accept iOS installations only (`functions/_shared/device.ts`) |

## Against iOS

### Features iOS has and the web lacks

| # | Feature | iOS | Web |
|---|---|---|---|
| I1 | Weekly, monthly and yearly wrap player | `Features/WeeklyWrap/` | `/wrap/[period]` renders a title only (`src/app/[locale]/(app)/wrap/[period]/page.tsx`). Home links to it for released periods (`src/app/[locale]/(app)/inicio/page.tsx`) |
| I2 | Purchasing Plus through the App Store (RevenueCat), restore, `sync-subscription` | `Core/Subscriptions/SubscriptionStore.swift` | The web sells prepaid passes instead ([plus-and-web-passes.md](plus-and-web-passes.md)) and links to the App Store |
| I3 | Referral: own code, share, redeem | `Features/Subscriptions/ReferralSection.swift`, `Core/Subscriptions/Referral.swift` | `/convite/[code]` shows the code and the App Store button. No redemption (B6) |
| I4 | Lifetime Plus gift announcement | `Features/Subscriptions/LifetimePlusGiftSheet.swift` | None |
| I5 | Push notifications, Live Activity, widgets, Siri and Spotlight, lock screen and widget privacy settings | `Core/Notifications/`, `InvestAOWidgets/`, `App/Intents/` | None. `/atividade` is the web's notification channel (`src/app/[locale]/(app)/atividade/page.tsx`) |
| I6 | Liquidity report and spread history | `get_liquidity_report`, `get_spread_history` in `Core/Market/Data/Supabase/SupabaseMarketRepository.swift` | Only the 20-session liquidity section computed from daily history (`LiquiditySection` in `src/features/market/instrument/account-panels.tsx`, `src/domain/market/liquidity.ts`) |
| I7 | Income reminders (local notifications) | `Features/Portfolio/…/IncomeReminderScheduler.swift` | None |
| I8 | News story image export; wrap share card and video | `Features/News/`, `Features/WeeklyWrap/` | None |
| I9 | Force-update gate | PostHog flag `ios-force-update` (`Core/FeatureFlags/`) | Not applicable; the web has only the maintenance flag `web-maintenance` (`src/data/flags/maintenance.ts`) |
| I10 | Onboarding intro pages and the paywall offer after setup | `Features/Onboarding/` | Account setup has the name and first-watchlist steps only (`src/features/account-setup/account-setup.tsx`) |
| I11 | Market order cost estimate on the order book | `Core/Market/Domain/OrderBookExecution.swift` | Not verified as present; `src/domain/market/order-book.ts` builds the level layout |

### Features the web has and iOS lacks

| # | Feature | Web | iOS |
|---|---|---|---|
| E1 | Public pages without sign-in: landing, market list, instrument pages, news, lessons | `src/app/[locale]/(site)`, `(market)` | Sign-in is mandatory (`Features/Authentication/…/AuthenticationRootView.swift`) |
| E2 | Plus web passes in kwanzas, checkout and order history | `/plus`, `/planos` | No mention of a web offer, Multicaixa or passes in code or the string catalogue |
| E3 | Shared portfolio page | `/partilha/[token]` | iOS creates the links (`Features/Portfolio/Data/PortfolioShares.swift`) and has no viewer |
| E4 | Public account-deletion page and Apple web deletion with a signed receipt | `/eliminar-conta`, `src/app/api/account/apple-deletion/*` | Deletion is in-app (`delete-apple-account` for Apple accounts) |
| E5 | Terms, support and invite pages | `/termos`, `/suporte`, `/convite/[code]` | No link to them; the referral message shares the code and the App Store link |
| E6 | Command palette search (`/`, Ctrl/⌘ K) | `src/features/search/command-palette.tsx` | Not applicable |

### Same feature, different rule or behaviour

| # | Topic | Web | iOS |
|---|---|---|---|
| D1 | Paywall | A dialog with the reason sentence and one "OK" button (`AccountProvider` in `src/features/account/account-provider.tsx`). It does not link to `/planos` | A paywall that offers the purchase (`Features/Subscriptions/`) |
| D2 | Enforcement switch | Features are open unless `enforcement_enabled` is true and `is_plus` is false; an unreadable access document locks nothing (`unlocksPlus` in `src/domain/account/access.ts`) | Same rule, plus a build switch `INVESTAO_SUBSCRIPTIONS_ENABLED` (`Configuration/*.xcconfig`, `Core/Subscriptions/SubscriptionStore.swift`). The web has no such switch |
| D3 | Number type of market prices | `Decimal` everywhere in `src/domain` (ESLint forbids float conversion, `eslint.config.mjs`) | Market prices, percentages and valuations are `Double`; the ledger, cash, thresholds and simulator are `Decimal` |
| D4 | Theme default | Without a `theme` cookie the page renders dark (`parseTheme` in `src/ui/theme/theme.ts`) | Appearance is dark, light or system, stored under `app.appearance` (`Core/DesignSystem/AppAppearance.swift`); the default was not compared |
| D5 | Language choice | A URL prefix (`/en`), chosen in settings or the site header (`src/features/settings/language-choice.tsx`, `src/features/site/language-switch.tsx`) | The device language (`Core/Formatting/AppLocalization.swift`) |
| D6 | Activity window | Alert rows of the last 28 days on the first page (`ACTIVITY_WINDOW_MS` in `src/domain/activity/activity.ts`) | 56-day retention and 200 items (`Core/Intelligence/ActivityPolicy.swift`) |
| D7 | Statement reading | Tesseract and PDF.js in the browser, at most 12 pages and 25 MB (`src/features/portfolio/statement-reader.ts`, `src/features/portfolio/csv-transfer.tsx`) | Vision OCR and PDFKit on device (`Features/Portfolio/…/StatementReader.swift`) |
| D8 | Account setup rollout date | Accounts created before 2026-11-11 UTC without a completion flag skip setup (`WEB_ACCOUNT_SETUP_ROLLOUT` in `src/domain/auth/account.ts`) | iOS uses its own rollout date; not compared |
| D9 | Telemetry | Cookieless, a random id per page load, an allow-list of six events (`src/data/telemetry/privacy.ts`). No feature flags per user | PostHog with feature flags, Sentry (`Core/FeatureFlags/`) |
| D10 | Polling | 30 s open or unknown, 60 s closed or opening soon, 120 s while Realtime flows; paused while the tab is hidden (`src/domain/market/refresh.ts`) | Same intervals (`Core/Market/Domain/Policies/MarketRefreshPolicy.swift`); the hidden-tab pause is web-only |
| D11 | Type and colour tokens | The iOS semantic colours are copied value for value (`src/ui/theme/tokens.css`); the web adds its own surface tokens, the Inter and Outfit fonts and a second type scale for wide pointer screens (`src/app/globals.css`) | System font with Dynamic Type (`Core/DesignSystem/`) |
| D12 | Messages | `messages/*.json` are generated from the iOS catalogue; the `site` namespace is web-only (`scripts/convert-messages.mjs`). Whether the committed files match the current iOS catalogue was not checked | `Resources/Localizable.xcstrings` |
| D13 | `PRO_REQUIRED` | Mapped to the share-links reason (`src/domain/errors/rules.ts`) | Mapped to the Plus paywall (`Features/Portfolio/Data/PortfolioShares.swift`). The backend no longer has a Pro tier (`migrations/20261112300000_plus_includes_pro.sql`) |
| D15 | Average cost across named portfolios | Average cost runs per `portfolio_id` (comment and code at `ledgers` in `src/domain/portfolio/calculator.ts`) | The code comment states iOS runs one average per security across portfolios (`Features/Portfolio/Data/PortfolioCalculator.swift`); the Swift code was not read line by line |
| D16 | Statement numbers with a dot decimal | `101.5` reads as one number (`src/domain/portfolio/statement.ts`) | The code comment states iOS splits it into `101` and `5` (`StatementTextParser`); the Swift code was not checked |
| D14 | Demo tier `pro` | A demo account `pro` exists and behaves as Plus (`src/data/demo/tiers.ts`) | No Pro tier |

## Gaps inside the web that touch these contracts

| # | Topic | Detail |
|---|---|---|
| G1 | Telemetry route templates | `ROUTE_TEMPLATES` (`src/data/telemetry/route-template.ts`) lists `/carteira/posicao/[symbol]`, which is not a route, and omits `/plus`, `/pesquisa`, `/mercado/informacao`, `/mercado/informacao/[id]`, `/mercado/admissao/[event]`, `/carteira/[id]`, `/carteira/registos`, `/carteira/rendimentos` and `/definicoes/conta`. Page views of those routes are reported as `/_not-found` |
| G2 | Legal text | `/policy`, `/termos` and `/suporte` render a draft notice (`DraftLegalPage` in `src/features/site/pages.tsx`). iOS links to `https://invest.ao/policy` |
| G3 | Market information | `/mercado/informacao` reads updates from the snapshot; the code states that no live source sends them (`src/app/[locale]/(market)/mercado/informacao/page.tsx`, `src/data/market/demo/scenarios.ts`) |
