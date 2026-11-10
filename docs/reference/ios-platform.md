# invest.ao iOS client — data, integration and platform-plumbing specification

Source: snapshot of iOS `origin/main`, marketing version **1.1.5**, build **18** (`Invest.AO.xcodeproj/project.pbxproj`). All paths are relative to the snapshot root. Code is the source of truth; anything not confirmed in code is marked `UNVERIFIED`. Secret values are never reproduced; only config names are given.

Conventions used below: "Luanda day" = a civil `yyyy-MM-dd` date in `Africa/Luanda` (UTC+1, no DST). `Calendar.market` = Gregorian calendar fixed to `Africa/Luanda`.

---

## 1. Project & configuration

### 1.1 Targets

| Target | Product type | Bundle identifier | Min OS | Devices | Notes |
|---|---|---|---|---|---|
| `Invest.AO` | application | `$(INVESTAO_BUNDLE_ID)` = `ao.invest.iosapp` (Release) / `ao.invest.iosapp.development` (Debug) | iOS 26.0 | iPhone only (`TARGETED_DEVICE_FAMILY = 1`), portrait only on iPhone | Display name `Invest.AO`; category `public.app-category.finance`; `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, approachable concurrency on |
| `InvestAOWidgets` | app-extension (WidgetKit) | `$(INVESTAO_BUNDLE_ID).widgets` | iOS 26.0 | iPhone + iPad (`1,2`) | Display name `invest.ao`; strict concurrency `complete`; Info.plist `Configuration/Widgets-Info.plist` (`NSExtensionPointIdentifier = com.apple.widgetkit-extension`) |
| `InvestAOUITests` | ui-testing bundle | `com.josetone.investao.uitests` | iOS 26.0 | iPhone | No team |
| SwiftPM `InvestAOMarketLogic` (library) + `InvestAOMarketLogicTests` | `Package.swift` | n/a | iOS 26 / macOS 14 | n/a | Compiles an explicit list of non-UI sources out of `Invest.AO/` so logic tests run with `swift test` on macOS. The `sources:` list in `Package.swift` is effectively the inventory of platform-independent logic. |

Project-level build settings carry `IPHONEOS_DEPLOYMENT_TARGET = 27.0`, but every target overrides it to **26.0**. Team `FWNTLC5S45`. Versioning: `MARKETING_VERSION = 1.1.5`, `CURRENT_PROJECT_VERSION = 18` (monotonic integer; `scripts/export-app-store.sh BUILD_NUMBER OUT` overrides it at archive time).

### 1.2 Environments (xcconfig)

Only two build configurations exist; there is **no separate staging configuration** — Debug is "local or staging", selected by an ignored `Configuration/Development.local.xcconfig` override.

| Key | Debug (`Configuration/Development.xcconfig`) | Release (`Configuration/Production.xcconfig`) | Surfaces as Info.plist key |
|---|---|---|---|
| `INVESTAO_ENVIRONMENT` | `development` | `production` | `InvestAOEnvironment` |
| `INVESTAO_BUNDLE_ID` | `ao.invest.iosapp.development` | `ao.invest.iosapp` | `PRODUCT_BUNDLE_IDENTIFIER` |
| `INVESTAO_APP_GROUP` | `group.ao.invest.iosapp.development` | `group.ao.invest.iosapp` | entitlement `com.apple.security.application-groups` (app + widgets) |
| `INVESTAO_URL_SCHEME` | `investao-dev` | `investao` | `CFBundleURLTypes[0].CFBundleURLSchemes` (URL name `com.josetone.investao`) |
| `INVESTAO_SUPABASE_URL` | `http://127.0.0.1:54321` (override locally) | `https://fwajbjthzqcdolduaaxm.supabase.co` | `InvestAOSupabaseURL` |
| `INVESTAO_SUPABASE_KEY` | placeholder (name only) | publishable key, must start with `sb_publishable_` (name only) | `InvestAOSupabaseKey` |
| `INVESTAO_GOOGLE_IOS_CLIENT_ID` | empty (=> Supabase web OAuth flow for Google) | `252543264089-2gjo3vllenppnuou43ho9m8o1edvbj3g.apps.googleusercontent.com` | `InvestAOGoogleIOSClientID` |
| `INVESTAO_SUBSCRIPTIONS_ENABLED` | `NO` | `YES` | `InvestAOSubscriptionsEnabled` |
| `INVESTAO_REVENUECAT_PUBLIC_KEY` | (name only) | (name only) | `InvestAORevenueCatPublicKey` |
| `INVESTAO_POSTHOG_PROJECT_TOKEN` | (name only) | (name only) | `InvestAOPostHogProjectToken` |
| `INVESTAO_POSTHOG_HOST` | `https://us.i.posthog.com` | `https://us.i.posthog.com` | `InvestAOPostHogHost` |
| `APS_ENVIRONMENT` (target build setting) | `development` | `production` | entitlement `aps-environment`, Info.plist `InvestAOAPNsEnvironment` |

Runtime guards (`Invest.AO/Core/Networking/InvestAOSupabase.swift`): a Debug/SwiftPM build `precondition`s that the Supabase host is **not** the production host; a Release build `precondition`s `InvestAOEnvironment == "production"`, URL exactly `https://fwajbjthzqcdolduaaxm.supabase.co`, and a key with prefix `sb_publishable_`. Backend device registration accepts only bundle `ao.invest.iosapp`, so Debug builds cannot register for push (`APPLE_RELEASE_CHECKLIST.md`).

### 1.3 Info.plist keys that matter (`Configuration/App-Info.plist` + generated keys)

| Key | Value | Purpose |
|---|---|---|
| `BGTaskSchedulerPermittedIdentifiers` | `com.josetone.investao.widget-refresh` | Background app-refresh task that refreshes widget snapshot |
| `UIBackgroundModes` | `fetch`, `remote-notification` | Background refresh + silent push |
| `NSSupportsLiveActivities` | `true` | Market-session Live Activity |
| `CFBundleURLTypes` | scheme `$(INVESTAO_URL_SCHEME)` | Deep links + OAuth callbacks |
| `InvestAOAppleSignInEnabled` | `true` | Shows Sign in with Apple |
| `InvestAOCompactHomeEnabled` | `false` | Compact Home projection (`home_v1`) switch; off in shipped build |
| `InvestAOAPNsEnvironment`, `InvestAOEnvironment`, `InvestAOGoogleIOSClientID`, `InvestAOPostHogProjectToken`, `InvestAOPostHogHost`, `InvestAOSupabaseKey`, `InvestAOSupabaseURL`, `InvestAOSubscriptionsEnabled`, `InvestAORevenueCatPublicKey` | see 1.2 | Runtime configuration |
| `UILaunchStoryboardName` | `LaunchScreen` | |
| `UISupportedInterfaceOrientations` | Portrait (iPhone) | |

### 1.4 Entitlements

| File | Entitlement | Value |
|---|---|---|
| `Invest.AO/Invest.AO.entitlements` | `aps-environment` | `$(APS_ENVIRONMENT)` |
| | `com.apple.developer.applesignin` | `[Default]` |
| | `com.apple.security.application-groups` | `[$(INVESTAO_APP_GROUP)]` |
| `Configuration/Widgets.entitlements` | `com.apple.security.application-groups` | `[$(INVESTAO_APP_GROUP)]` |

There is **no `com.apple.developer.associated-domains` entitlement**: the iOS app has no universal links (`applinks:`). All inbound links are custom-scheme (see section 11).

### 1.5 Privacy manifest (`Invest.AO/PrivacyInfo.xcprivacy`)

No tracking. Collected: Device ID (linked; app functionality + analytics), Crash data (linked), Other diagnostic data (linked), Performance data (not linked), Product interaction (linked; analytics). Required-reason APIs: UserDefaults (`CA92.1`, `1C8F.1`), system boot time (`35F9.1`), file timestamp (`C617.1`). Widgets: UserDefaults only.

---

## 2. Dependencies

Xcode project packages (`Invest.AO.xcodeproj/project.pbxproj`, resolved in `project.xcworkspace/xcshareddata/swiftpm/Package.resolved`):

| Package | Requirement / resolved | Product linked | Used for |
|---|---|---|---|
| `supabase/supabase-swift` | exact **2.54.1** | `Supabase` | PostgREST (tables/views/RPC), Auth, Edge Functions, Realtime v2 broadcast. Only backend SDK. |
| `RevenueCat/purchases-ios-spm` | exact **5.96.0** | `RevenueCat` | In-app subscription purchase/restore and customer info (section 8) |
| `PostHog/posthog-ios` | exact **3.92.4** | `PostHog` | Product analytics + sanitized handled errors; feature flags are fetched by the app's own HTTP call, not the SDK (section 9) |
| `getsentry/sentry-cocoa` | up-to-next-major from **9.30.1** | `Sentry-Dynamic` | Native crash reporting only (no tracing, breadcrumbs, replay) |
| transitive | swift-crypto 4.5.1, swift-asn1 1.7.1, swift-http-types 1.6.0, swift-clocks 1.1.1, swift-concurrency-extras 1.4.1, swift-issue-reporting 2.1.0, xctest-dynamic-overlay 1.13.1 | | Supabase dependencies |

Root `Package.swift` (tooling/logic package `InvestAOFormatting`): `airbnb/swift` from 1.0.0 (resolved 1.2.0; format/lint plugin, `scripts/format-swift.sh`, `scripts/lint-swift.sh`) and `supabase-swift` exact 2.54.1; transitive `swift-argument-parser` 1.8.2. Default localization `pt`.

Apple frameworks relied on: SwiftUI, Observation, Swift Charts, WidgetKit, ActivityKit (Live Activity), AppIntents, CoreSpotlight, BackgroundTasks, UserNotifications, AuthenticationServices (Apple + Google web auth session), StoreKit (review prompt; purchase flow goes through RevenueCat), CryptoKit, Network (`NWPathMonitor`), AVFoundation (weekly wrap video export).

---

## 3. Backend call map

### 3.0 Transport facts that apply to every row

| Topic | Behaviour | File |
|---|---|---|
| Client | One `SupabaseClient` singleton `InvestAOSupabase.client`; options `auth.emitLocalSessionAsInitialSession = true`, custom `URLSession` | `Invest.AO/Core/Networking/InvestAOSupabase.swift` |
| Timeouts | Request 20 s, resource 30 s for everything that goes through the Supabase client. Exceptions: account deletion requests (30 s, own session), PostHog flags (8 s), logo downloads (8 s request / 20 s resource, ephemeral session), Google token exchange (`URLSession.shared` defaults) | same; per-row below |
| HTTP cache | `URLCache` 4 MiB memory / 32 MiB disk, `useProtocolCachePolicy`. PostgREST sends no cache headers, so in practice only the `market-snapshot` GET (ETag + `max-age`) is served from cache / revalidated with 304 | same |
| Pagination helper | `SupabaseRead.all(query)`: `.range(from, to)` pages of **500** rows until a short page; SDK retry **disabled** (`.retry(enabled: false)`). Any row-returning list a second client reads must page under the server row cap (history uses 1000-row keyset pages) | `Invest.AO/Core/Networking/SupabaseRead.swift` |
| Lossy lists | `LossyRow<T>` decodes each element independently; malformed rows are dropped instead of failing the list (used for the securities catalogue) | same |
| Retry | There is **no automatic per-request retry** in the app. Polled reads are simply repeated on their schedule; failures of the quote loop back off (3.1.4). User-facing retries go through `ErrorCoordinator.retryCurrent()` (section 10) | |
| Auth header | Anonymous reads send the publishable key only (role `anon`); signed-in calls send the user JWT automatically. The app never creates Supabase anonymous sessions; an anonymous session found in storage is signed out locally before sign-in and is treated as "signed out" | `AuthenticationStore.swift` |
| Account race guard | Every user-scoped repository calls `SupabaseAccountSession.userID()` before (and usually after) a request and throws `CancellationError` when the session's user changed mid-flight. `validatedUserID()` additionally calls `auth.user()` (server round-trip) | `Invest.AO/Features/Authentication/Data/SupabaseAccountSession.swift` |
| Error wrapping | Repositories catch and rethrow `AppErrorMapper.map(error, operation:)`; `nil` (cancellation) becomes `CancellationError`. Operation names are listed per row | section 10 |
| Dates on the wire | Instants: ISO-8601 strings, with or without fractional seconds (`BackendDateParsing.instant`, `MarketNotificationTimestamp.parse`, `SupabaseMarketMapping.timestamp` — the latter accepts **no** fractional seconds unless noted). Civil days: `yyyy-MM-dd` interpreted in `Africa/Luanda`; `SupabaseMarketMapping.tradingDate` maps a day to **12:00 Luanda** (so the instant falls on the same civil day in any device zone), `BackendDateParsing.marketDay` / `MarketEventDay` map to Luanda midnight. Epoch fields (`*_epoch`, `validUntilEpoch`) are seconds as JSON numbers | `Invest.AO/Core/Formatting/BackendDateParsing.swift`, `SupabaseMarketMapping.swift` |
| Numbers on the wire | Market prices/volumes: JSON numbers decoded as `Double`. Ledger quantities/prices/fees, cash amounts, alert thresholds and notification delivery prices: JSON numbers decoded as `Decimal` (Postgres `numeric(24,8)`). Wrap evidence prices and frozen portfolio notification evidence: **strings** parsed with `en_US_POSIX` `Decimal` | per row |
| IDs | Security ids, issuer ids, ledger ids, alert ids, group ids, book ids are handled as lowercase UUID **strings**; user ids, article ids, notification ids as UUID. Client generates ids for ledger rows, cash movements, alerts and watchlist groups (`UUID().uuidString.lowercased()`) so writes are idempotent | per row |

### 3.1 Market core (public market data, watchlist membership)

Repository: `SupabaseMarketRepository` (`Invest.AO/Core/Market/Data/Supabase/SupabaseMarketRepository.swift`), consumed by `MarketStore` (all tabs) and `HomeMarketStore` (compact Home, disabled in the shipped build).

| # | Identifier | Kind | Parameters sent | Response model | Used by | Auth | Cache / TTL / staleness | Retry / timeout / operation |
|---|---|---|---|---|---|---|---|---|
| M1 | `market-snapshot` | Edge Function, **GET**, no body | none | `MarketSnapshotBundle` (3.1.1) | Every quote load: Home, Markets, Watchlist, Search, Asset details, Portfolio valuation, widgets, simulator | anon OK | Server-side cached response (ETag + max-age honoured by URLCache). Client accepts only `contract_version == 1` and `generated_at <= now + 60 s`. `fresh_until` (if > `generated_at`) lets the bundled `pulse`, `calendar` and `control` satisfy M3/M6 without their own requests until that instant | On HTTP >= 500, relay error or URL timeout: route switches to direct reads (M2+M4+M5) for **300 s** (`MarketSnapshotRoute`), and the failing refresh itself fails (no same-refresh fallback). On any other failure (4xx, decode, contract mismatch): falls through to direct reads in the same refresh. op `supabase.fetchLightSnapshot` / store op `market.load` |
| M2 | `get_current_market_quotes` | RPC, no params | none | `CurrentMarketQuotes` (3.1.2) | Direct-read fallback for M1 | anon OK | none client-side; quote validity is carried per row in `data_quality.validUntilEpoch` | as M1 |
| M2b | `get_current_market_quotes` + header `X-InvestAO-Projection: home_v1` | RPC with header | none | `HomeProjectionResponse` (3.1.3) | Compact Home projection (`HomeMarketStore`), only when Info.plist `InvestAOCompactHomeEnabled` is true (false in 1.1.5) | anon OK | Projection discarded on every foreground/suspend; never cached | op `market.homeProjection`; returns nil (use full snapshot) unless `contract_version == 1 && requires_full_snapshot == false`; strict validation failures throw `.decoding` ops `market.homeContract`, `market.homeDeadline`, `market.homeEligibility` |
| M3 | `quality_market_pulse_history` | view select `*` | (a) index: `order trading_date desc, limit 30`, SDK retry off; (b) full history: `gte trading_date >= first day of previous calendar year (Luanda)`, `order trading_date asc`, paged 500 | `[MarketPulseRow]` | Market index ("pulse") value + sparkline; weekly wrap history | anon OK | (a) is skipped entirely while the bundled `pulse` from M1 is fresh (`now < fresh_until`). Loaded once on first quote load, then only on explicit `loadMarketIndex(force:)` | ops `market.index`, `supabase.fetchMarketPulseHistory` |
| M4 | `securities` | table select `id,symbol,isin,name,currency,security_type,issuer_id,is_active` | `order symbol, id`, paged 500, lossy rows | `[SecurityRow]` | Direct-read fallback catalogue | anon OK | none | as M1 |
| M5 | `latest_verified_market_closes` | view select `*` | `order security_id`, paged 500 | `[VerifiedCloseRow]` | Direct-read fallback; verified closing prices | anon OK | Failure is tolerated (`try?`): snapshot gets `unavailableSections = ["market.snapshot.verifiedCloses" localized]` | n/a |
| M6 | `get_market_calendar` | RPC | `starts_on`, `ends_on` (`yyyy-MM-dd`); window = Monday of current Luanda week minus 28 days … Sunday of that week plus 14 days | `MarketCalendarRepository.Response` (3.1.5) | Market state (open/closed/pre/post/holiday), quote policy, Live Activity, wraps, week ahead, intelligence | anon OK | Response carries `fetched_at`/`valid_until`; client requires `fetched <= now < valid_until` and `valid_until <= fetched + 121 s` (direct) or `<= fetched + 310 s` when taken from the snapshot bundle (then expiry = bundle `fresh_until`). Skipped when the bundle's calendar matches the requested window and is fresh | failure is tolerated in the quote load (`try?`), leaving market status `unknown`; throws `.decoding` ops `market.calendar*` |
| M7 | `watchlist_items` | table select `security_id,sort_order` | `eq user_id`, `order sort_order, created_at, security_id`, paged 500 | `[WatchlistRow]` | Watchlist tab, Home watchlist, widgets, intelligence | signed-in (signed out returns `[]` without a request) | Reloaded each foreground and after confirmed mutations; coalesced; discarded if a mutation raced it | op `market.watchlist` |
| M8 | `watchlist_items` | select then insert | select `security_id, sort_order` `eq user_id` `order sort_order desc`; insert `{user_id, security_id, sort_order = max+1}` | none | Add to watchlist | signed-in | optimistic UI, rollback on failure | op `supabase.setWatchlist`; server error message `FREE_WATCHLIST_LIMIT` triggers the paywall (section 8) |
| M9 | `watchlist_items` | delete | `eq user_id`, `eq security_id` | none | Remove (no undo) | signed-in | | op `supabase.setWatchlist` |
| M10 | `watchlist_items` | delete … returning | `eq user_id`, `eq security_id`, `select user_id,security_id,sort_order,automatic_alerts_enabled,created_at` | `[WatchlistRemovalReceipt]` (0 or 1 rows) | Remove with undo (toast) | signed-in | Receipt kept in memory for the undo window | op `supabase.removeWatchlist` |
| M11 | `watchlist_items` | insert (plain, not upsert) | the `WatchlistRemovalReceipt` row verbatim | none | Undo removal | signed-in | A conflict means newer membership exists and is left intact | op `supabase.restoreWatchlist` |
| M12 | `reorder_watchlist` | RPC | `security_ids: [String]` (complete confirmed order) | none | Drag reorder | signed-in | | op `supabase.setWatchlistOrder` |
| M13 | `price_history` | table select `security_id,trading_date,close_price,open_price,high_price,low_price,volume` | `eq security_id`, `lte trading_date <= today(Luanda)`, optional `gte`, keyset `gt trading_date > cursor`, `order trading_date`, `limit 1000` per page | `[PriceHistoryRow]` | Asset detail chart (1S…Tudo), comparison chart, simulator, portfolio history, CSV export | anon OK | `MarketStore` keeps a per-security receipt: not refetched while the Luanda trading day and the security's verified-close/reference inputs are unchanged and the last request is < 300 s old | ops `supabase.fetchPriceHistory`, store `market.history`; cursor regression throws `.decoding` `supabase.historyCursor` |
| M14 | `price_history` | table select `security_id,trading_date,close_price` | `in security_id (<= 20 ids per request)`, `gte trading_date >= now - 45 days`, `lte today`, `order trading_date desc`, `limit 1000` | `[PriceHistoryRow]` | Widget sparklines only | anon OK | At most once per hour (`loadWidgetHistories`) | op `supabase.fetchRecentCloses`; failures ignored |
| M15 | `get_intraday_chart` | RPC | `requested_security_id` | `IntradayChartRow` (3.1.6) | Asset detail 1D range | anon OK | Per security: reused for 60 s; callers join in-flight request | ops `supabase.fetchIntradayChart`, store `market.intraday`. Any point with a future timestamp or undecodable timestamp empties the series |
| M16 | `get_intraday_price_history` | RPC | `requested_security_id`, `requested_trading_date` (`yyyy-MM-dd`) | `[IntradayCandleRow]` | Legacy intraday path (protocol default / tests); the shipped chart uses M15 | anon OK | | op `supabase.fetchIntradayPriceHistory` |
| M17 | `issuers` | table select `*` | `eq id`, `eq is_active true`, `limit 1` | `[IssuerRow]` | Asset detail: issuer section (lazy) | anon OK | Per security+section state kept in memory until foreground reset | op `market.detail.issuer` |
| M18 | `issuer_financial_reports` | table select `*` | `eq issuer_id`, `order period_end desc, id`, paged 500 | `[IssuerFinancialReportRow]` | Asset detail: reports section | anon OK | as M17 | op `market.detail.reports`; rows without an `https` URL dropped |
| M19 | `latest_issuer_dividends` | view select `*` | `eq issuer_id`, `order fiscal_year desc`, `limit 1` | `[IssuerDividendRow]` | Asset detail: dividend section | anon OK | as M17 | op `market.detail.dividend` |
| M20 | `quality_latest_order_books` | view select `security_id,trading_date,order_book_levels,data_quality` | `eq security_id`, `order trading_date desc`, `limit 2` (more than 1 row => `.invalidResponse`) | `[OrderBookRow]` | Asset detail: order book / depth | anon OK | Book shown only while market is open and `data_quality` permits current use (two-minute source ceiling) | op `market.detail.orderBook` |
| M21 | `get_available_market_wraps` | RPC, no params | none | `[MarketWrapWindowRow]` | Home: which weekly/monthly/annual wraps are released | anon OK (results used for signed-in wrap) | Refreshed independently of quotes; a failure keeps the previous windows; expiry applied locally | op `supabase.fetchAvailableWrapPeriods` |
| M22 | `issuer_dividends` | table select `id,issuer_id,fiscal_year,record_date,ex_dividend_date,payment_date,source_url,updated_at,issuers(id,name)` | `order id`, paged 500 | `[DividendRow]` | Week ahead / market events calendar | anon OK | `MarketEventStore` in-memory batch (fresh per `MarketEventBatch` policy) + per-user replay copy in `IntelligenceCache` kind `weekAhead` | failure falls back to a replayable cached batch flagged `isCached` |
| M23 | `market_events` | table select `*,issuers(id,name,logo_url,description)` | `eq kind new_listing`, `neq status cancelled`, `or(expires_at.gt.<now>,and(status.eq.confirmed,effective_at.gte.<now-5d>))`, `order priority desc, id`, `limit 50` | `[MarketListingRow]` | New-listing highlights on Home, asset listing content, week ahead | anon OK | none; **no stale fallback** — any failure yields an empty list | swallowed |
| M24 | Realtime broadcast | channel `market:prices`, private, event `quotes` | subscribe only | payload key `generated_at` (ISO-8601 string, optional) | Triggers one M1 reload | requires whatever the server's Realtime authorization grants to the current token (anon or user) — `UNVERIFIED` which roles are allowed | see section 5 | resubscribe after 30 s |

#### 3.1.1 `MarketSnapshotBundle` (response of `market-snapshot`)

| JSON key | Type | Required | Notes |
|---|---|---|---|
| `contract_version` | Int | yes | must equal 1 |
| `generated_at` | String (ISO-8601, no fractional seconds accepted by this parser) | yes | must be `<= now + 60 s`; stored as `sourceMetadata.snapshotGeneratedAt` and compared with realtime announcements |
| `securities` | [`SecurityRow`] (lossy per element) | yes | |
| `quotes` | `CurrentMarketQuotes` | yes | |
| `closes` | [`VerifiedCloseRow`] | optional | missing => "verified closes" marked unavailable |
| `fresh_until` | String (ISO-8601) | optional, failure-tolerant | must be > `generated_at` to enable the extras cache |
| `pulse` | [`MarketPulseRow`] | optional, failure-tolerant | |
| `calendar` | calendar `Response` (3.1.5) | optional, failure-tolerant | used only if its `starts_on`/`ends_on` equal the client's requested window |
| `control` | `{ "maintenance": Bool, "min_poll_seconds": Int }` | optional, failure-tolerant | last known control stays in force until a newer snapshot replaces it |

`SecurityRow`: `id` String, `symbol` String, `isin` String?, `name` String?, `security_type` String, `currency` String, `issuer_id` String?, `is_active` Bool.

`VerifiedCloseRow`: `security_id` String, `price` Double, `trading_date` `yyyy-MM-dd`, `confirmed_at` ISO-8601, `verified_change_percent` Double?. Accepted only when `price` finite > 0, `trading_date` (Luanda midnight) `<= confirmed_at <= now`; `verified_change_percent` kept only if finite and `> -100`.

`MarketPulseRow`: `trading_date` String, `value` Double, `daily_change_percent` Double, `data_quality` `DataQualityReport`?. The index is shown only if **every** row is valid (parsable date, value > 0, finite change, `data_quality` permits insight) and dates are unique; otherwise value/history are empty. `dailyChange` = last value − previous value; `percentageChange` = last row's `daily_change_percent`.

#### 3.1.2 `CurrentMarketQuotes`

| JSON key | Type | Required | Notes |
|---|---|---|---|
| `prices` | [`MarketPriceRow`] | yes | duplicates per `security_id` cause that security to have **no** price |
| `sessions` | [`MarketSessionRow`] | yes | first element used |
| `overview` | [`MarketOverviewRow`] | yes | first element used |
| `availability` | `MarketSourceAvailability` | optional, failure-tolerant | diagnostics only |
| `reference_prices` | [`MarketReferencePriceRow`] | optional, failure-tolerant | duplicates per security dropped |
| `active_security_ids` | [String] | optional, failure-tolerant | when present defines `officialMarketVisibility` |

`MarketPriceRow`: `security_id` String; `trading_date` String?; `open_price`, `close_price`, `high_price`, `low_price`, `last_price` Double?; `verified_change_percent` Double? (-> `percentageChange`, the only movement used for calculations/alerts); `change_percent` Double? (BODIVA-reported, display only); `volume` Double?; `trade_count` Int?; `data_quality` `DataQualityReport`?. Current price = `last_price ?? close_price`.

`MarketSessionRow`: `trading_date` String, `total_volume` Double?, `trade_count` Int?, `status` String?, `published_at` String?, `updated_at` String?, `data_quality` `DataQualityReport`?.

`MarketOverviewRow`: `status` String? (`open` | `opening_soon`/`pre_open` | `closed`, anything else unknown — and note the displayed status is recomputed from the calendar, not taken from here), `last_updated_at`, `source_trading_date`, `collected_at`, `published_at` String?, `data_status` String? (`"stale"` is meaningful).

`MarketReferencePriceRow`: `security_id`; `reference_price` `{ price: Double?, price_date: yyyy-MM-dd, traded_at: ISO?, collected_at: ISO, source_url, source_hash (64 hex), parser_version }`?; `reference_unavailable_reason`, `reference_last_checked_at`, `reference_update_status`, `reference_update_reason` String?. A reference is valid only if the source URL is `https` on host `bodiva.ao` / `www.bodiva.ao`, hash is 64 hex chars, `collected_at <= now`, `price_date <= collected_at` day, and `traded_at` (if any) is on `price_date` and `<= collected_at`.

`MarketSourceAvailability` (camelCase **and** snake_case keys mixed, exactly as listed): `status` (`available` | `delayed` | `sourceUnavailable` | `partial` | unknown fallback), `lastSuccessfulObservationAtEpoch`, `lastAttemptAtEpoch`, `retryAfterEpoch` Double?, `availableInstrumentCount`, `totalInstrumentCount` Int?, `sourceTradingDate` String?, `session_quote_count`, `reference_price_count`, `missing_price_count`, `active_instrument_count` Int?, `coverage_date` String?.

`DataQualityReport` (JSON keys are the Swift names, camelCase): `status` (`valid` | `incomplete` | `stale` | `delayed` | `invalid` | `unknown`; unknown strings decode to `unknown`), `reasons` [String] (`missingObservation`, `missingSession`, `duplicateObservation`, `invalidValue`, `invalidTimestamp`, `missingProvenance`, `inconsistentCurrency`, `notFinal`, `incompletePeriod`, `unavailableCalendar`, `staleFetch`, `stalePeriod`, `staleObservation`, `delayedIngestion`, `missingMetadata`, `invalidLedger`; unknown strings decode to `missingMetadata`), `observedAt` Date? (`UNVERIFIED` wire format: decoded with the default `JSONDecoder` date strategy, i.e. a number of seconds since 2001-01-01, when present; the server appears to send the epoch fields instead), `validUntilEpoch` Double?, `sourceObservedAtEpoch` Double?.

#### 3.1.3 `HomeProjectionResponse` (compact Home, flag off)

`contract_version` Int?, `requires_full_snapshot` Bool?, `generated_at` String?, `summary` `HomeMarketSummary`?, `calendar` calendar Response?, `securities` [`SecurityRow`]? (<= 9, unique), `quotes` `CurrentMarketQuotes`?. `HomeMarketSummary`: `instrument_count`, `available_quote_count` Int, `valid_until_epoch` Double, `last_observation_epoch` Double?, `session_quote_count`, `reference_price_count`, `missing_price_count`, `active_instrument_count` Int?, `coverage_date` String?. The projection is accepted only while the market is open and every card has a usable quote valid at least until `valid_until_epoch`.

#### 3.1.4 Quote polling, backoff and server control

| Rule | Value | Source |
|---|---|---|
| Base poll interval | 30 s when status is open/unknown; 60 s when closed or opening soon; **120 s** while the realtime feed is connected (polling is then only a watchdog) | `MarketRefreshPolicy.interval(for:liveFeed:)` |
| Server floor | `control.min_poll_seconds` clamped to 5…3600; `control.maintenance == true` forces >= 300 s and suppresses realtime-triggered reloads and background widget refresh | `MarketRefreshPolicy.interval(_:control:)`, `MarketStore.isInMaintenance` |
| Skip rule | A poll tick does not hit the network if the last success is younger than the interval, unless a `validUntilEpoch` deadline of the fetched response has since passed (one early refresh) | `MarketStore.refreshIfNeeded` |
| Failure backoff | First failure: normal cadence. From the 2nd consecutive failure: `max(floor, min(300, base * 2^(n-1)) * random[0,1))` with `floor = min(300, max(base, retry_after_seconds))`. `retry_after_seconds` is read from the JSON error body of Functions/HTTP errors. Offline failures do not count | `MarketRefreshPolicy.backoff`, `AppErrorMapper.retryAfter` |
| Explicit refresh | Pull-to-refresh / explicit `load(force:)` ignores the backoff window | `MarketStore.load` |
| Reconnect | `NWPathMonitor` transition offline->online clears the last-success time and triggers `refreshIfNeeded()` | `MarketConnectivityMonitor` |
| Portfolio ledger poll | every 60 s while active and signed in | `ApplicationShell.swift` |
| Watchlist intelligence poll | every 60 s while active | `ApplicationShell.swift` |
| News feed poll | every 60 s while the feed is visible | `NewsFeedStore.swift` |

#### 3.1.5 Calendar contract (`get_market_calendar` response, also `calendar` in the bundle and `calendar_snapshot` in wrap evidence)

`contract_version` Int (>= 2), `timezone` (must be `"Africa/Luanda"`), `version` String (non-empty), `source` (https URL without credentials), `fetched_at`, `valid_until` (ISO instants), `starts_on`, `ends_on` (`yyyy-MM-dd`, inclusive), `regular_weekdays` [Int] (Foundation weekday numbers: 1 = Sunday … 7 = Saturday; unique, non-empty), `opens_at`, `closes_at` (`HH:mm:ss` with seconds == 0), `days` [`{ day, kind, opens_at?, closes_at? }`] — exactly one entry per civil day in the window, in order, at most 400. `kind` values: `regular` (must be a regular weekday with the normal hours), `exceptional_session` (own hours), `holiday`, `exceptional_closure`, `non_trading` (no hours; `non_trading` on a regular weekday is rejected). Any violation rejects the whole calendar (`.decoding`), which makes the market state `unknown`.

#### 3.1.6 Intraday

`IntradayChartRow`: `session_date` String (`yyyy-MM-dd`, shown as `dd/MM/yyyy`), `status` String, `source` String (default label `"trades"`), `last_checked_at`, `last_trade_at` String?, `points` [`IntradayCandleRow`]. `IntradayCandleRow`: `security_id`, `bucket_at` (ISO instant), `open_price`, `high_price`, `low_price` Double?, `close_price` Double, `volume`, `traded_amount` Double?, `trade_count` Int?. The 1D chart prepends the previous close (verified close or last history point before the session day) as an anchor point 1 ms before `min(sessionOpen, firstPoint)`.

#### 3.1.7 Other row models

- `PriceHistoryRow`: `security_id`, `trading_date`, `close_price`, `open_price`, `high_price`, `low_price`, `volume` (Double?). Points without a close or with an invalid date are dropped; a candle with incoherent OHLC degrades to close-only (`MarketPriceValidator.reportedClose`).
- `IssuerRow`: `id`, `name`, `short_name`?, `logo_url`?, `website_url`?, `sector`?, `headquarters`?, `description`?. Only `https` URLs are accepted. Logo fallback: `https://www.google.com/s2/favicons?domain_url=<issuer website>&sz=128`.
- `IssuerFinancialReportRow`: `id`, `issuer_id`, `title`, `reporting_period`?, `published_at`? (instant or day), `url`?.
- `IssuerDividendRow`: `issuer_id`, `amount_per_share` Double?, `currency`?, `ex_dividend_date`?, `payment_date`?, `frequency`?.
- `OrderBookRow`: `security_id`, `order_book_levels` [`{ side: "bid"|"ask", level: Int, price: Double, quantity: Double, order_count: Int? }`], `data_quality`?. Levels with price <= 0 or quantity < 0 are dropped; sorted by `level`.
- `MarketWrapWindowRow`: `period_type` (`WeeklyWrapKind` raw value: weekly / monthly / annual — see section 12), `starts_on`, `ends_on` (days), `available_at`, `expires_at` (instants). Rejected unless `expires_at > available_at`, window <= 72 h, `available_at >= start`.
- `WatchlistRemovalReceipt` (Codable both ways): `user_id` UUID, `security_id` String, `sort_order` Int, `automatic_alerts_enabled` Bool, `created_at` String.
- `MarketListingRow` (`market_events`): `id`, `kind` (`new_listing`), `issuer_id`, `security_id`?, `title`, `scheduled_date` (day), `starts_at`, `expires_at`, `effective_at`?, `status` (`scheduled` | `confirmed` | `cancelled`), `priority` Int, `highlights_home` Bool, `source_url`, `source_name`, `confirmation_url`? (required when confirmed), `updated_at`, `issuers { id, name, logo_url, description }`. Any missing/invalid field drops the row.
- `DividendRow` (`issuer_dividends` for events): `id`, `issuer_id`, `fiscal_year` Int, `record_date`?, `ex_dividend_date`?, `payment_date`?, `source_url` (https), `updated_at`, `issuers { id, name }`. Each present date becomes one event `dividend:<id>:<milestone>`.

### 3.2 Portfolio (ledger, books, cash, sharing, benchmark, income)

Files: `Invest.AO/Features/Portfolio/Data/SupabasePortfolioRepository.swift`, `PortfolioBooks.swift`, `PortfolioCash.swift`, `PortfolioShares.swift`, `PortfolioBenchmark.swift`, `IncomeCalendarRepository.swift`. All signed-in only. Portfolio valuation uses quotes from the market snapshot (3.1); there is no server-side valuation call.

| # | Identifier | Kind | Parameters | Response model | Used by | Cache / staleness | Operation / errors |
|---|---|---|---|---|---|---|---|
| P1 | `get_portfolio_ledger_page` | RPC, repeated | `expected_revision` (String?, null on first page), `after_traded_on` (`yyyy-MM-dd`?), `after_created_at` (String?), `after_id` (String?) — the last row of the previous page, echoed verbatim | `{ revision: String, transactions: [Row] }`, pages of up to **500** | Portfolio tab, widgets, portfolio intelligence, cash balance | Polled every 60 s while active; whole ledger kept in memory (`PortfolioStore`); result is reversed before use (server returns newest-first — `UNVERIFIED`, inferred from `.reversed()`) | `supabase.fetchPortfolio`; `.decoding` op `portfolio.ledger` if revision changes between pages, page > 500, cursor repeats, any row fails to map, or the ledger fails `PortfolioInputValidator.records` |
| P2 | `portfolio_transactions` | upsert `onConflict: id`, `ignoreDuplicates: true` | `id`, `user_id`, `security_id`, `transaction_kind`, `quantity`, `unit_price`, `fees`, `traded_on`, `portfolio_id` (omitted when nil — older backends lack the column) | none | Add transaction (also CSV / statement import) | Idempotent: a retry after a lost response is a no-op | `supabase.createPortfolioTransaction` |
| P3 | `portfolio_transactions` | update `eq id` | `transaction_kind`, `quantity`, `unit_price`, `fees`, `traded_on` | none | Edit transaction | | `supabase.updatePortfolioTransaction` |
| P4 | `portfolio_transactions` | delete `eq id` | | none | Delete transaction | | `supabase.deletePortfolioTransaction` |
| P5 | `portfolios` | select `id,name` `order created_at, id` | | `[PortfolioBook {id, name}]` | Portfolio book menu (named portfolios; the main portfolio has no row, `portfolio_id = null`) | in memory | `portfolio.books` |
| P6 | `portfolios` | insert … `select id,name` `.single()` | `user_id`, `name` | `PortfolioBook` | Create book (Plus) | | `portfolio.createBook`; server message `PLUS_REQUIRED` -> paywall; Postgres `23505` -> duplicate name |
| P7 | `portfolios` | update `{name}` `eq id` | | none | Rename book | | `portfolio.renameBook` |
| P8 | `portfolios` | delete `eq id` | | none | Delete book | | `portfolio.deleteBook` |
| P9 | `portfolio_cash_movements` | select `id,kind,amount,occurred_on,portfolio_id` `order occurred_on, id`, paged 500 | | `[Row]` | Cash section / balance (Plus) | in memory | `portfolio.cash` |
| P10 | `portfolio_cash_movements` | upsert `onConflict: id`, `ignoreDuplicates: true` | `id`, `user_id`, `portfolio_id`, `kind`, `amount`, `occurred_on` | none | Add cash movement | idempotent | `portfolio.createCash`; `PLUS_REQUIRED` -> paywall |
| P11 | `portfolio_cash_movements` | delete `eq id` | | none | Delete cash movement | | `portfolio.deleteCash` |
| P12 | `portfolio_shares` | select `id,label,created_at`, `eq portfolio_id` or `is portfolio_id null`, `order created_at desc` | | `[PortfolioShare]` | "Client views" share sheet (Pro) | none | untyped |
| P13 | `create_portfolio_share` | RPC | `share_portfolio_id` (String or **explicit JSON null** for the main portfolio), `share_label` | `{ token: String }` | Create read-only share link `https://invest.ao/partilha/<token>` — the token is returned only once | none | messages `PRO_REQUIRED` -> requires Pro, `SHARE_LIMIT` -> limit, else failed |
| P14 | `portfolio_shares` | delete `eq id` | | none | Revoke link | | |
| P15 | `market_rates` | select `rate_name,value,trading_date`, `in rate_name (BenchmarkRate raw values)`, `order trading_date desc`, `limit 5 x number of rates` | | rows -> latest `BenchmarkQuote` per rate | Portfolio benchmark section (Plus) | fetched when the section is empty | `benchmark.rates` |
| P16 | `issuer_dividends` | select `issuer_id,amount_per_share,ex_dividend_date,record_date,payment_date`, `in issuer_id`, `gte payment_date >= since`, `order payment_date` | | `[IssuerDividendRecord]` (rows without amount or payment date dropped) | Income calendar (Plus) + local reminders | per screen load | `income.dividends` |

Ledger row (`Row`, P1): `id` String, `security_id` String, `transaction_kind` String (`buy` | `sell` | `income`), `quantity` Decimal, `unit_price` Decimal, `fees` Decimal?, `traded_on` `yyyy-MM-dd` (-> 12:00 Luanda), `created_at` ISO-8601, `portfolio_id` String?.

Cash row: `id`, `kind` (`deposit` | `withdrawal` | `fee`), `amount` Decimal, `occurred_on` `yyyy-MM-dd`, `portfolio_id`?. `PortfolioShare`: `id`, `label`, `created_at`.

Local persistence: selected portfolio in `UserDefaults` `investao.portfolio.selection` (`combined` | `main` | `<book id>`). `LocalPortfolioRepository` / `LocalPortfolioBookRepository` / `LocalPortfolioCashRepository` are in-memory implementations for previews and tests only.

### 3.3 Alerts (`notification_rules`)

File: `Invest.AO/Features/Alerts/Data/SupabaseMarketAlertRepository.swift`; store `MarketAlertsStore`. Signed-in only.

| # | Identifier | Kind | Parameters | Response | Used by | Operation |
|---|---|---|---|---|---|---|
| A1 | `notification_rules` | select `id, security_id, kind, threshold, is_enabled, created_at, securities(symbol, name, security_type)`, `eq user_id`, `order created_at desc, id`, paged 500 | | `[NotificationRuleRow]` | Alert sheet, watchlist alert view, activity | `supabase.fetchAlerts` / store `alerts.load` |
| A2 | `notification_rules` | upsert `onConflict: id` | `id`, `user_id`, `security_id`, `kind`, `threshold`, `is_enabled` | none | Create alert | `supabase.createAlert` |
| A3 | `notification_rules` | update `eq id` | `kind`, `threshold`, `is_enabled` | none | Edit / toggle | `supabase.updateAlert` |
| A4 | `notification_rules` | delete `eq id` | | none | Delete | `supabase.deleteAlert` |

`kind` wire values: `price_above`, `price_below`, `percent_change_above`, `high_52w`, `low_52w`, `volume_above_average`, `days_without_trades`. `threshold` is `numeric(24,8)`: must be > 0, < 10^16, at most 8 decimals. Per-kind rules (mirrors server check `notification_rules_threshold_by_kind`): 52-week kinds fixed at 1; `volume_above_average` 1.5…20 (default 2); `days_without_trades` whole number <= 365 (default 7); price/percent kinds any valid threshold. Alerts are evaluated and delivered **server-side**; the client only manages rules.

### 3.4 Notification inbox (Activity Center)

File: `Invest.AO/Features/Notifications/Data/SupabaseMarketNotificationRepository.swift`; store `ActivityCenterStore` + `MarketAlertsStore`. Signed-in only. Retention constant `ActivityPolicy.retention = 56 days`, `ActivityPolicy.maximumItems = 200`.

| # | Identifier | Kind | Parameters | Response | Notes |
|---|---|---|---|---|---|
| N1 | `get_account_notifications` | RPC, keyset pages | `page_size: 50`, `before_created_at` (String?), `before_id` (UUID?) — last row of previous page; at most **4 pages** (200 rows) | `[AccountNotificationRow]` | Current notification schema ("account notifications"). Every row's `user_id` must equal the session user or the load is cancelled |
| N2 | `get_portfolio_notification_evidence` | RPC | `notification_id` UUID | `FrozenPortfolioNotificationEvidence`? | Called once per `portfolio_daily` row whose `content_state == "active"`; failure only marks that item unavailable |
| N3 | `notification_deliveries` | select (legacy) | select list: `id, created_at, is_read, delivery_kind, rule_id, market_price_id, market_price_change_id, market_alert_event_id, market_event_id, previous_price, current_price, event_change_percent, alert_snapshot, securities(id, symbol, name, security_type), notification_rules(kind, threshold, securities(id, symbol, name, security_type))`; `eq user_id`, `gte created_at >= now-56d`, `order created_at desc, id`, `limit 200`, paged | `[NotificationDeliveryRow]` | Legacy deliveries, merged after account notifications; dropped when their `sourceEventID` or article already appears in N1 |
| N4 | `market_recap_receipts` | select `id,created_at,is_read,market_recaps(article_id,trading_date)`, same window/order/limit | | `[RecapReceiptRow]` | Legacy recap receipts |
| N5 | `news_articles` | select `id,title,summary`, `eq status published`, `published_at` within [yesterday 00:00 Luanda, now], `in id (...)` | | title/summary for N4 rows | |
| N6 | `acknowledge_account_notifications` | RPC | `notification_ids: [UUID]` (<= 100), `opened: Bool` | ignored | Mark read (`opened: false`) / opened from push (`opened: true`) for ids prefixed `account:` |
| N7 | `market_recap_receipts` | update `{is_read: true}` `eq id` | | | ids prefixed `recap:` |
| N8 | `notification_deliveries` | update `{is_read: true}` `eq id` | | | legacy ids |
| N9 | `account_notifications` | select `*` `eq id`, `eq user_id` | | `[AccountNotificationRow]` | Resolve a tapped push (`notification_id`) to its record before routing |

`AccountNotificationRow`: `id` UUID, `user_id` UUID, `semantic_key` String (dedupe identity; `wrap:<periodKey>` for wraps), `category` String (`asset_movement`, `market_listing`, `market_recap`, `news_publication`, `portfolio_daily`, `weekly_wrap`, `unusual_activity`, `daily_close`), `security_id` String?, `article_id` UUID?, `occurred_at`, `created_at` ISO, `read_at` ISO?, `content_state` String (`active` = renderable), `composition` and `preview_composition` (`VoiceComposition`: `catalogueVersion`, `strategyId`, `hookId`, `hookFamily`, `factClauseId`, `closerId`, `title`, `body`, `accessibilityText`, `privacyClass`, `playful` — camelCase keys, `UNVERIFIED` exact optionality, see `Core/ProductVoice/ProductVoice.swift`), `facts` (object; decoded as `UnusualActivityFacts` for `unusual_activity`, `DailyCloseFacts` for `daily_close`, ignored otherwise). For `unusual_activity` and `daily_close` the title/body are **re-rendered locally in the app language** from `facts`; other categories display the server's (Portuguese) `preview_composition`.

`FrozenPortfolioNotificationEvidence` (camelCase keys, all numbers as strings): `schemaVersion`, `calculationVersion` Int, `calendarVersion`, `baselineDate`, `tradingDate` (`yyyy-MM-dd`), `startValue`, `endValue`, `change`, `percentage`, `generatedAt`, `positions[] { assetID, symbol, quantity, startPrice, endPrice, startValue, endValue, contribution, percentagePoints, startRecordID, endRecordID, startRunID, endRunID, startCollectedAt, endCollectedAt }`.

`NotificationDeliveryRow.delivery_kind` values handled: `market_listing`, `watchlist_price_change`, `automatic_movement`, `intraday_movement`, otherwise a rule-based threshold alert (uses `alert_snapshot` frozen rule if present, else the joined `notification_rules`). Derived source-event ids: `<kind>:event:<market_alert_event_id>`, `<kind>:change:<market_price_change_id>`, `rule:<rule_id>:price:<market_price_id>`, `listing:<market_event_id>`, `article:<article_id>`.

Local persistence: activity archive and read/open queue are stored by `ActivityArchive` / `ActivityPersistence` (per user, on disk); items older than 56 days are pruned. Details of the on-disk format were not examined: `UNVERIFIED`.

### 3.5 Notification preferences

| # | Identifier | Kind | Parameters | Response | File |
|---|---|---|---|---|---|
| NP1 | `notification_preferences` | select `*` `eq user_id` `limit 1` | | `NotificationPreferences` (missing row => defaults) | `Features/Settings/NotificationCategoryControls.swift` |
| NP2 | `notification_preferences` | upsert (whole row) | `user_id`, `watched_movements_enabled` (default true), `held_asset_movements_enabled` (true), `portfolio_daily_enabled` (true), `listings_enabled` (true), `daily_close_enabled` (**false**), `public_previews_enabled` (true) | none | optimistic toggle with rollback |
| NP3 | `user_movement_preferences` | select `sensitivity` `eq user_id` `limit 1` | | `low` \| `normal` \| `high` (default `normal`) | `Features/Notifications/Data/MovementAlertPreferences.swift` |
| NP4 | `user_movement_preferences` | upsert `onConflict: user_id` | `user_id`, `sensitivity` | none | |
| NP5 | `watchlist_items` | select `automatic_alerts_enabled` `eq user_id`, `eq security_id`, `limit 1` | | Bool? | per-instrument automatic movement alerts |
| NP6 | `watchlist_items` | update `{automatic_alerts_enabled}` `eq user_id`, `eq security_id` | | none | server message `FREE_MOVEMENT_LIMIT` -> paywall (free plan: 1 instrument) |
| NP7 | `user_recap_preferences` | select `enabled` `eq user_id` `limit 1` | | Bool (default false) | `MarketRecapPreferencesRepository.swift` |
| NP8 | `set_market_recap_preference` | RPC | `wants_recaps: Bool` | none | |
| NP9 | `unusual_activity_preferences` | select `user_id,notifications_enabled,disabled_rules` `eq user_id` `limit 1` | | `UnusualActivityPreferences` (missing => defaults) | `Features/UnusualActivity/Data/UnusualActivityRepository.swift` |
| NP10 | `unusual_activity_preferences` | upsert (whole row) | `user_id`, `notifications_enabled`, `disabled_rules` [rule raw values] | none | op `unusualActivity.savePreferences` |

Local-only notification toggles also exist in `UserDefaults`: `investao.settings.priceAlertsEnabled`, `investao.settings.marketMovementNotificationsEnabled`, `investao.settings.marketInformationNotificationsEnabled`, `investao.income.reminders`, `investao.liveActivity.marketSession`.

### 3.6 Watchlist groups (Plus)

File: `Invest.AO/Features/Watchlist/Data/WatchlistGroups.swift`. Signed-in only.

| # | Identifier | Kind | Parameters | Operation / errors |
|---|---|---|---|---|
| G1 | `watchlist_groups` | select `id,name` `order created_at, id`, paged 500 | | `watchlist.groups` |
| G2 | `watchlist_group_items` | select `group_id,security_id` `order group_id, security_id`, paged 500 (run concurrently with G1) | | `watchlist.groups` |
| G3 | `watchlist_groups` | insert | `id` (client UUID), `user_id`, `name` | `watchlist.createGroup`; `PLUS_REQUIRED`; `23505` duplicate name |
| G4 | `watchlist_groups` | update `{name}` `eq id` | | `watchlist.renameGroup` |
| G5 | `watchlist_groups` | delete `eq id` | | `watchlist.deleteGroup` |
| G6 | `watchlist_group_items` | insert | `group_id`, `user_id`, `security_id` | `watchlist.groupMember` (optimistic, rollback) |
| G7 | `watchlist_group_items` | delete `eq group_id`, `eq security_id` | | `watchlist.groupMember` |

Selected group is remembered locally under the `investao.watchlist.group` key prefix.

### 3.7 News / editorial

File: `Invest.AO/Features/News/Data/NewsRepository.swift`; store `NewsFeedStore` (page size 20, fetches `limit + 1` to detect more, polls every 60 s). Public (anon OK; RLS is the boundary). Base filter on every query: `eq status published`, `lte published_at <= now`.

| # | Identifier | Kind | Parameters | Response | Used by |
|---|---|---|---|---|---|
| W1 | `news_articles` | select summary list | select: `id,slug,title,summary,published_at,recap_period, market_recaps(trading_date), news_article_categories(news_categories(name)), news_article_sources(source_url,source_title,is_primary,news_sources(name)), news_article_securities(securities(id,symbol,name))`; `order published_at desc, id desc`; `range(offset, offset+limit-1)` | `[NewsArticleSummary]` | News archive |
| W2 | `news_articles` | same select + `gte published_at >= yesterday 00:00 Luanda`, `limit 3` (Home) or `limit 20` (insight publications) | | `[NewsArticleSummary]` | Home news, watchlist "information" insights |
| W3 | `news_articles` | select `body_markdown,` + summary list, `eq id`, `limit 1` | | `[NewsArticle]` | Article detail (also from push `article_id`) |
| W4 | `news_articles` | summary select + `ilike title %<escaped>%` (escapes `\`, `%`, `_`), paged 500 | | `[NewsArticleSummary]` | Search tab news results |

`NewsArticle`: `id` UUID, `slug`, `title`, `summary`, `body_markdown` (Markdown subset rendered by `NewsMarkdown`; links restricted by `NewsMarkdown.safeURL`), `published_at` (decoded as `Date` by the PostgREST decoder), `recap_period` String? (`weekly` | `monthly` | `annual`; nil + `market_recaps` => daily recap), `market_recaps { trading_date }`?, `news_article_categories[] { news_categories { name } }`, `news_article_sources[] { source_url, source_title?, is_primary, news_sources { name } }`, `news_article_securities[] { securities { id, symbol, name? } }`. The app has **no public article URL**; `slug` is decoded but not used to build links.

### 3.8 Unusual activity

| # | Identifier | Kind | Parameters | Response | Notes |
|---|---|---|---|---|---|
| U1 | `get_unusual_activity` | RPC, no params | | `[UnusualActivityEventRow]` | Events of the latest session that had any; public (the screen works signed out); op `unusualActivity.load` |

`UnusualActivityEventRow`: `id` UUID, `security_id` UUID, `symbol`, `name`?, `trading_date` (day), `rule` (`large_trade`, `large_order`, `volume_spike`, `trade_count_spike`, `price_move`, `dormancy_break`, `spread_change`, `spread_shift`, `book_imbalance`; unknown rules are skipped), `observed_value`, `baseline_value` Double, `facts` (flat object of number | string | bool | [string]; known keys include `rule`, `securityKind`, `symbols`), `occurred_at` (instant), `status` (withdrawn events flagged). User-configurable rules: all except `spread_shift` and `book_imbalance`. Copy is generated locally (`UnusualActivityCopy.swift`).

### 3.9 Weekly wrap evidence

| # | Identifier | Kind | Parameters | Response | Notes |
|---|---|---|---|---|---|
| R1 | `get_market_period_evidence` | RPC | `starts_on`, `ends_on` (`yyyy-MM-dd`, inclusive civil period), `requested_kind` (wrap kind raw value) | `Response` | Signed-in feature; the wrap is **assembled client-side** from this evidence + the user's watchlist/ledger. The live request requires `contract_version == 3` and a `calendar_snapshot`; decoding tolerates 1…3 for cached data |

`Response`: `contract_version` Int, `fetched_at` ISO, `baseline_day` `yyyy-MM-dd`? (last trading day before the period; missing => `insufficientHistory`), `calendar[] { day, is_open, opens_at?, closes_at?, revision? }` covering exactly [period start − 14 days, period end], `observations[] { record_id, asset_id, currency_code, price (string decimal), observed_at, collected_at, ingestion_run_id, source_sha256 (64 hex), parser_version, dataset (prefix "price_history."), is_final, data_quality? (required at v3) }`, `calendar_snapshot` (calendar contract 3.1.5). The client cross-checks the legacy day list against the snapshot calendar and rejects mismatches. Caching: `WeeklyWrapCache` / `WeeklyWrapArchive` persist built wraps per user (cleared on sign-out expiry and deletion); format not examined in depth: `UNVERIFIED`.

### 3.10 Personalisation activity upload

| # | Identifier | Kind | Parameters | Notes |
|---|---|---|---|---|
| S1 | `user_activity_daily` | upsert `onConflict: user_id,installation_id,activity_day,kind,security_id,related_security_id,variant` | rows `{ user_id, installation_id (UUID), activity_day (yyyy-MM-dd), kind, security_id?, related_security_id?, variant, activity_count }` | Daily aggregated counters, never raw events. Skipped in privacy mode and when signed out |
| S2 | `user_activity_daily` | select same columns, `eq user_id`, `gte activity_day >= sinceDay`, `order activity_day desc, id asc`, `range` pages of 500 | | Merges other installations' aggregates into the local interest profile |

`kind` values: `asset_view`, `search_select`, `comparison` (uses `related_security_id`), `chart_range` (`variant` = range raw value `1D`/`1S`/`1M`/`3M`/`6M`/`1A`/`Tudo`), `watchlist_add`, `watchlist_remove`, `wrap_open`, plus weekly-wrap lifecycle event raw values (`variant` = wrap period key).

### 3.11 Issuer logos

| # | Identifier | Kind | Parameters | Notes |
|---|---|---|---|---|
| L1 | `issuers` | select `logo_url,website_url` (filter by issuer id) | | `Core/Components/SecurityLogoCache.swift`; resolves a logo URL lazily for list rows |
| L2 | image GET | raw HTTPS download, ephemeral session, 8 s / 20 s | logo URL (https only, no credentials) or `https://www.google.com/s2/favicons?domain_url=<website>&sz=128` | Decoded off-main, cached by `PublicLogoResourceCache` (`Core/Images`) |

### 3.12 Subscriptions, referrals, feature controls (details in sections 8 and 9)

| # | Identifier | Kind | Parameters | Response | Auth |
|---|---|---|---|---|---|
| B1 | `get_subscription_access` | RPC, no params | | `SubscriptionAccess` | signed-in |
| B2 | `sync-subscription` | Edge Function, POST, no body | | ignored | signed-in |
| B3 | `select_free_watchlist` | RPC | `security_ids: [String]`, `movement_id: String?` | `SubscriptionAccess` | signed-in |
| B4 | `authorize_chart_comparison` | RPC | `security_ids: [String]` | `SubscriptionAccess`; error messages `FREE_COMPARISON_SIZE_LIMIT`, `FREE_COMPARISON_WEEK_LIMIT`, `COMPARISON_DATA_UNAVAILABLE` | signed-in |
| B5 | `claim_lifetime_plus_announcement` | RPC, no params | | `LifetimePlusGift`? `{ id, owner_name }` | signed-in |
| B6 | `get_referral` | RPC, no params | | `ReferralInvite`? `{ code, can_redeem, credit_until? }` (null while referrals are closed) | signed-in |
| B7 | `redeem_referral_code` | RPC | `referral_code: String` | none; error messages `REFERRAL_CODE_INVALID`, `REFERRAL_OWN_CODE`, `REFERRAL_ALREADY_USED`, `REFERRAL_NOT_ELIGIBLE`, `REFERRALS_UNAVAILABLE` | signed-in |
| B8 | `intelligence_feature_configuration` | table select `payload` `eq id true` `.single()` | | JSON `payload` (section 9.5) | anon OK |
| B9 | PostHog `POST {host}/flags?v=2` | raw HTTPS, 8 s timeout, no cache | `{ api_key, distinct_id (installation id), person_properties { platform: "ios", environment, app_version } }` | `{ flags: { <key>: { enabled, metadata { payload } } }, errorsWhileComputingFlags?, quotaLimited? }` | none |

### 3.13 Auth, account, device (details in sections 4 and 7)

| # | Identifier | Kind | Parameters | Notes |
|---|---|---|---|---|
| X1 | Supabase Auth `signInWithIdToken` | Auth | Apple: `provider: apple, idToken, nonce (raw)`; Google native: `provider: google, idToken, accessToken, nonce (raw)` | |
| X2 | Supabase Auth `signInWithOAuth` | Auth (web session) | `provider: google`, `redirectTo: <scheme>://auth/callback`, query `prompt=select_account` | only when no native Google client id is configured |
| X3 | Supabase Auth `update(user:)` | Auth | user metadata keys `full_name`, `investao_display_name`, `investao_name_skipped`, `investao_onboarding_completed` | post-login onboarding |
| X4 | Supabase Auth `signOut()` / `signOut(scope: .local)` | Auth | | |
| X5 | `register-device` | Edge Function POST | `DeviceRegistration` (section 7) | signed-in |
| X6 | `unregister-device` | Edge Function POST | `{ "deviceId": String }` | signed-in |
| X7 | `delete-apple-account` | raw POST `{supabaseURL}/functions/v1/delete-apple-account`, 30 s | headers `Authorization: Bearer <access token>`, `apikey`, JSON body `{ "expectedUserID": UUID, "authorizationCode": String }` | accounts with an Apple identity; 200 = deleted, 401 -> unauthenticated, else server error |
| X8 | `delete_user_account` | RPC via a dedicated PostgREST client pinned to the confirmed access token, 30 s, retry off | none | accounts without an Apple identity |
| X9 | Supabase Auth `user(jwt:)` / `user()` / `session` | Auth | | identity verification before deletion and for account-only features |

No Supabase **Storage** API is used anywhere in the client.

---

## 4. Auth

Files: `Invest.AO/Features/Authentication/Data/AuthenticationStore.swift`, `GoogleNativeSignIn.swift`, `SupabaseAccountSession.swift`, `AccountDeletionRepository.swift`, `AppleDeletionAuthorization.swift`, `AccountDeletionLocalData.swift`; wiring in `Invest.AO/App/InvestAOApp.swift` and `App/AppRootView.swift`.

### 4.1 Sign-in methods

Only two methods exist; there is **no email/password, magic link, phone or anonymous sign-in**.

| Method | Shown when | Flow | Supabase call |
|---|---|---|---|
| Sign in with Apple | Info.plist `InvestAOAppleSignInEnabled == true` | Native `SignInWithAppleButton`; scopes `email`, `fullName`. Raw nonce = two concatenated UUID strings; the request carries `SHA256(nonce)` as lowercase hex | `auth.signInWithIdToken(provider: .apple, idToken: <Apple identity token>, nonce: <raw nonce>)` |
| Google (native) | always shown; native path when `InvestAOGoogleIOSClientID` ends in `.apps.googleusercontent.com` (Release) | App-driven OAuth 2 authorization-code + PKCE in `ASWebAuthenticationSession` (non-ephemeral). Authorization URL `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri = com.googleusercontent.apps.<client-id-prefix>:/oauth2redirect`, `response_type=code`, `scope=openid email profile`, `code_challenge` (base64url SHA-256 of a 32-byte base64url verifier), `code_challenge_method=S256`, `state` (32 random bytes base64url, verified on return), `nonce = SHA256hex(raw nonce)`, `prompt=select_account`. Token exchange: `POST https://oauth2.googleapis.com/token` form-encoded `client_id`, `code`, `code_verifier`, `grant_type=authorization_code`, `redirect_uri`; requires HTTP 200 with `id_token` and `access_token` | `auth.signInWithIdToken(provider: .google, idToken, accessToken, nonce: <raw nonce>)` |
| Google (web fallback) | client id empty (Debug default) | Supabase hosted OAuth in a web auth session | `auth.signInWithOAuth(provider: .google, redirectTo: "<scheme>://auth/callback", queryParams: [prompt=select_account])` with `prefersEphemeralWebBrowserSession = false` |

Before either sign-in, if the stored session is a Supabase **anonymous** user it is removed with `auth.signOut(scope: .local)`. The app itself never calls `signInAnonymously`. User cancellation (Apple `.canceled`, web session `.canceledLogin`, task cancellation) is silent.

Android/web note: the backend's Google provider must accept the new platform's client id as an authorized audience, and the web client needs its own redirect URL allow-listed; `UNVERIFIED` server configuration.

### 4.2 State machine

`AuthenticationStore.State`: `restoringSession` (launch splash stays up) -> `signedIn(User)` | `signedOut` | `restorationUnavailable` (saved session exists but refresh failed for a non-auth reason, e.g. offline; shows a retry).

| Trigger | Behaviour |
|---|---|
| Launch | `observeSession()` iterates `auth.authStateChanges`. On `.initialSession` (emitted from local storage because `emitLocalSessionAsInitialSession` is on) it calls `restoreSessionIfNeeded(force: true)`: no stored session -> `signedOut`; otherwise `await auth.session` (refreshes an expired token). Refresh failure that maps to unauthenticated/session-expired -> `expireSession()`; other failures -> `restorationUnavailable` with op `auth.restore` |
| Other auth events | `apply(session)`: nil or anonymous -> `signedOut`; expired -> `restorationUnavailable`; a session for the just-deleted user id is ignored; while the error coordinator is in "requires authentication" state a new session is accepted only during an explicit sign-in |
| Apple credential check | On user change, on each foreground after the first market load, and when an auth error surfaces: `ASAuthorizationAppleIDProvider.credentialState(forUserID: <identities[apple].identity_data.sub>)`; `revoked` / `notFound` -> `expireSession()`. Only for users whose `app_metadata.provider == "apple"`. No Android/web equivalent |
| Backend says session invalid | Any mapped error with `requiresAuthentication` (categories `unauthenticated`, `sessionExpired`) handled by `ErrorCoordinator` sets `requiresAuthentication`; the root view then expires the session |
| `expireSession()` | Awaits `onSessionExpired` cleanup first (4.4), sets `signedOut`, sets failure `sessionExpired` op `auth.expireSession` (if there was an account session), then `auth.signOut(scope: .local)` |
| `signOut()` | `beforeSignOut` (push release, failures logged as `push.unregisterOnLogout` but never block), then `auth.signOut()` (global). If the SDK already cleared local credentials but remote revocation failed -> still `signedOut`, informational banner (context `signOut`). Otherwise error with retry, op `auth.signOut` |

Session persistence and refresh are entirely the Supabase SDK's (Keychain storage, auto-refresh); development and production are isolated by bundle id. A second client should use its SDK's default persistent storage and replicate the "resolve the real session before leaving the splash" rule.

### 4.3 Guest vs signed-in

The introduction carousel (`OnboardingFlowView`, flag `investao.onboarding.completed`) is installation-scoped; after it, the app is usable **signed out**: market snapshot, quotes, charts, order book (first 5 levels), issuer info, news, unusual activity, search, learn, simulator inputs. Signed-in is required for: watchlist (`watchlist_items` returns empty without a request when signed out), alerts, notifications/activity, portfolio, weekly wrap, week ahead, Saturday discover, intelligence insights, personalisation, subscriptions, referrals, chart comparison authorization, simulation snapshot (`fetchAuthenticatedLightSnapshot` validates the user against Auth), push registration. `UNVERIFIED`: exact per-screen sign-in prompts (covered by the UI spec).

### 4.4 Cleanup sequences (exact order as wired in `InvestAOApp.init`)

| Event | Steps |
|---|---|
| Sign out (`beforeSignOut`) | `releasePushInstallation(removeServer: true)`: call `unregister-device` with the installation id; in a `defer` (always, even on failure): `unregisterForRemoteNotifications`, remove all delivered and pending notifications, clear `PendingNotificationRoute.route`, set badge 0. Then `auth.signOut()`. State change to `signedOut` triggers `subscriptions.setAccount(nil)` (RevenueCat `logOut`) and `widgets.revokePrivate()` (deletes owner/watchlist/portfolio widget files) |
| Session expiry (`onSessionExpired`) | `revokePrivateState()` = widgets revoke + reset of `MarketStore`, `MarketAlertsStore`, `PortfolioStore`, `WatchlistGroupStore`; then clear `MarketSnapshotCache`, `WeeklyWrapCache`, `IntelligenceCache`, `MarketEventStore`, `ActivityCenterStore` session, `PersonalisationStore`, `PersonalizationSession`; then push release — the server association is removed only if the current token is still unexpired (revoked Apple credential case), otherwise only the pending registration is dropped |
| Sign-in as a different user | `widgets.setAccount(newID)` returns true -> reset market, portfolio and watchlist-group stores |
| Account deleted (`onAccountDeleted(deletedID, currentID)`) | `IntelligenceCache.deleteAccount`, `MarketEventStore.clear`, `WeeklyWrapCache.deleteAccount`, `AccountDeletionLocalData.clear` (removes that user's `LocalProductVoice` data, `investao.accountSetup.<uid>.*`, `investao.onboarding.preferencesApplied.<uid>`), `PersonalisationStore.clear(userID)`, `ContentExposureStore.remove(userID)`. Only if no replacement account is signed in: also the un-namespaced keys `investao.search.recentSecurityIDs`, `investao.onboarding.profile|goals|securities|requestNotifications`, `investao.settings.priceAlertsEnabled|marketMovementNotificationsEnabled|marketInformationNotificationsEnabled`, private state reset, all notifications removed, `URLCache.shared` emptied, all `market_snapshot_*.json` caches, wrap cache, pending push registration, badge 0 |

### 4.5 Account deletion (client side)

Entry: Settings -> delete account (confirmation UI mentions that an App Store subscription must be cancelled separately and links `https://apps.apple.com/account/subscriptions`).

1. Guard: not already working, `userID == expectedUserID`.
2. `auth.session` (refresh) and `auth.user(jwt:)` must both return the expected user id (else `invalidState`).
3. If the user has an `apple` identity: obtain a fresh Apple **authorization code** via `ASAuthorizationController` (re-authorization prompt), refresh and re-verify the session, then `POST /functions/v1/delete-apple-account` (row X7). The server revokes the Apple token and deletes the account. `UNVERIFIED`: how a non-Apple platform deletes an Apple-linked account (it cannot produce an Apple authorization code natively; a web "Sign in with Apple" re-auth or a server-side path would be needed).
4. Otherwise: RPC `delete_user_account` through a dedicated PostgREST client bound to the confirmed access token (row X8) so a session swap cannot redirect the deletion.
5. On success: error coordinator reset, `onAccountDeleted` cleanup, `auth.signOut(scope: .local)` if still that user, `deletedAccountID` remembered so late auth events for it are ignored, state `signedOut` (or the replacement account).
6. On failure: never auto-retried and never claims rollback (the request may have committed). Messages by category: requires authentication -> "sign in again"; `invalidState` -> "account changed"; offline/connectionLost/timeout -> "check connection"; else "retry". Op name `account.delete`.

### 4.6 Post-login account setup

Name + first watchlist picks after first sign-in (`PostLoginOnboardingStore/Persistence`). Needed when: server metadata `investao_onboarding_completed == false`, or a local draft exists, or the account was created after this installation's rollout date (`investao.accountSetup.rolloutDate`, set on first run) and has no completion flag. Local keys `investao.accountSetup.<uid>.completed|draft` (draft JSON: `step` name|watchlist, `name`, `hasEditedName`, `skippedName`, `selectedIDs`, `category`). Server writes via `auth.update(user:)` metadata: enrolment `investao_onboarding_completed: false`; Apple-provided name `full_name`; name save `investao_display_name` + `investao_name_skipped: false`; completion `investao_onboarding_completed: true` + `investao_name_skipped`. Display name resolution order: `investao_display_name`, then `full_name`, then `name` (the latter two ignored when `investao_name_skipped` is true). A hard-coded developer email unlocks the in-app intelligence debugger (`AuthenticationStore.canAccessIntelligenceDebugger`); not user-facing.

---

## 5. Realtime

File: `Invest.AO/Core/Market/Data/Supabase/MarketQuoteBroadcast.swift`, lifecycle in `Invest.AO/App/ApplicationShell.swift`, consumer `MarketStore.applyQuoteAnnouncement`.

| Aspect | Behaviour |
|---|---|
| Channels | Exactly one: Realtime v2 **broadcast** topic `market:prices`, event `quotes`, channel option `isPrivate = true` (requires Realtime authorization; clients may only listen). No Postgres-changes or presence subscriptions anywhere |
| Payload | Only `generated_at` (ISO-8601 string, optional) is read. The message is a hint, not data |
| Subscribe lifecycle | A task keyed by scene phase + foreground generation + "initial load completed" runs only while the scene is **active** and the first quote load has completed. Leaving the foreground cancels the task, which ends the stream and removes the channel. Subscription failure: remove channel, wait 30 s, retry. Stream end: status false, remove channel, loop |
| Status | `onStatus(true/false)` sets `MarketStore.isReceivingLiveQuotes`, which stretches the polling interval to 120 s (watchdog) |
| Merge | On each message: ignored when suspended, before the first live snapshot, in server maintenance, inside a failure backoff window, when a load started < 5 s ago, or when `generated_at <=` the loaded snapshot's `generated_at`. Otherwise wait a **random 0–10 s** (thundering-herd spread), then `load(force: true, forcesHistoryRefresh: false)` — a normal `market-snapshot` reload. State is replaced by the new snapshot while preserving already loaded histories, lazily loaded detail sections, watchlist membership and the index |
| Missed message cost | One polling interval |

---

## 6. Caching, offline and freshness

### 6.1 Persistence inventory

| Store | Technology / location | Contents | Lifetime | Cleared |
|---|---|---|---|---|
| `MarketSnapshotCache` | JSON file `Library/Caches/market_snapshot_v4.json`, complete file protection, excluded from backup, max 32 MiB | Last displayed `MarketSnapshot` | Restored only as **dated closing references**: quotes, index, volume and trades are stripped, status `unknown`, statistics marked `stale/staleFetch`. Requires at least one verified closing price in the file; files without closes older than 24 h are deleted. Restored only after a fresh calendar response in the current foreground reports a known state | session expiry, account deletion (all versions) |
| HTTP `URLCache` | 4 MiB / 32 MiB | effectively the `market-snapshot` GET | server headers | account deletion |
| `MarketSnapshotExtras` | in memory | bundled pulse, calendar, client control | until bundle `fresh_until`; control until replaced | process end |
| Widget files | App Group container `Widgets/{market,watchlist,portfolio,owner}-v1.json`, envelope `{version: 1, value}`, max 512 KiB each | Pre-formatted display strings (section 13) | overwritten by the app | private files on sign-out/expiry |
| `IntelligenceCache` | JSON files `Application Support/IntelligenceCache-v1/<uid>/<kind>.json`, max 2 MiB | Cached insights (`portfolio`, `watchlist`) and the week-ahead event batch | 7 days (week ahead 24 h), plus fingerprint checks against the ledger / watchlist / market | invalidated on ledger or watchlist change, expiry, deletion |
| `WeeklyWrapCache` / `WeeklyWrapArchive` | on disk per user (`UNVERIFIED` path/format) | Built wraps and their history | per wrap window / archive policy | expiry, deletion |
| Activity archive | on disk per user (`UNVERIFIED` path/format) | Activity Center items, read/open queue | 56 days, 200 items | expiry |
| `PersonalisationStore`, `ContentExposureStore`, ranking cache | on disk / defaults per user (`UNVERIFIED` format) | Daily activity aggregates, exposure history | config-driven | expiry, deletion |
| `LocalProductVoice` | per user | recently used copy variants (avoid repetition) | | deletion |
| `UserDefaults` (standard) | keys prefixed `investao.` | see 6.5 | | partly on deletion |
| `UserDefaults` (App Group suite, `PrivacyPreferences.defaults`) | `investao.privacy.enabled`, `investao.privacy.widgetFinancialDisclosure`, `investao.privacy.scopeExplained` | privacy mode shared with widgets | | |
| Keychain | Supabase SDK session | | | sign-out |
| Core Spotlight | domain `ao.invest.securities` | visible securities (symbol, name, dated price) | re-indexed when the visible set/description changes | |

There is **no offline database** (no SwiftData/Core Data/SQLite). Offline behaviour is: keep what is on screen, downgrade its eligibility, and restore dated closes on next launch.

### 6.2 Market time model

- `Calendar.market`: Gregorian, time zone `Africa/Luanda`, first weekday Monday, minimum 4 days in first week. Every civil-day decision (trading day, "today", week boundaries, ledger dates, publication windows) uses it, never the device zone.
- `BodivaMarketCalendar` is built **only** from the server calendar contract (3.1.5). A weekday alone never establishes a trading day; without a valid, unexpired calendar the state is `unknown`. Default hours constant (used only for the intraday chart anchor when no session is confirmed): 09:00–15:30.
- `MarketState` from the calendar at instant t: `open`, `preMarket` (trading day, before open), `postClose`, `closed` (exceptional closure or scheduled non-trading weekday), `weekend`, `holiday`, `unknown`. UI `MarketStatus`: open -> `open`; preMarket -> `openingSoon`; closed/postClose/holiday/weekend -> `closed`; unknown -> `unknown`. **The server's `status` string is not used for display**; the client recomputes it from the calendar on every reassessment.
- `nextTransition(after:)` = the earliest of the next session open/close, the calendar's `validUntil`, and coverage end. It becomes `marketContextValidUntil` for the snapshot and every security: after it, nothing is "current" until the calendar is refetched.
- Week identity: Monday 00:00 Luanda to next Monday; wrap period key `weekly-YYYY-MM-DD` (the Monday).

### 6.3 Current-quote policy (`MarketSnapshot.applyingCurrentQuotePolicy`, `MarketSecurity`, `DataQualityReport`; doc `docs/current-quote-policy.md`)

A quote is **usable** (`hasUsableQuote`) only when all hold: instrument listed; a positive price exists; its `data_quality` is `valid` with no reasons; `now < validUntilEpoch`; observation timestamps are not in the future; market status is known and `now < marketContextValidUntil`; while the market is **open** additionally `sourceObservedAtEpoch` is present, `validUntilEpoch <= sourceObservedAtEpoch + 120` (two-minute source ceiling) and the quote's `trading_date` is today in Luanda. When a deadline passes the quality is rewritten to `stale` / `staleFetch` locally (timer scheduled for the next deadline) without a network call; after a failed refresh all quotes and order books are invalidated the same way (`permitsQuotes: false`).

Displayed price precedence (`displayPrice(asOf:)`), each with a label:

| Order | Condition | Value | Label key |
|---|---|---|---|
| 1 | usable quote dated today and not superseded by a close | live `price` | `market.price.bodivaQuote` |
| 2 | valid BODIVA reference price and no same-day session quote (and no usable quote from the same or a later day) | `reference_price.price` | `market.price.bodivaReference` (no movement shown) |
| 3 | market closed / opening soon, context valid, verified close exists, and either no usable quote or the close is not older than the quote | verified close | `common.lastBodivaClose` |
| 4 | any other usable quote | `price` | `market.price.bodivaQuote` |
| 5 | last reported price whose quality is valid/stale/delayed only for staleness reasons, dated today or earlier | `price` | `market.price.lastBodivaQuote` |
| - | otherwise | none ("no quote") | |

Movement: `verified_change_percent` is the only figure used for calculations, alerts and insights; BODIVA's reported `change_percent` may be displayed (`displayPercentageChange`) but never used for maths; with a closing display price the verified close's change is used; a reference price shows no change. Order book is shown only when status is open, context valid and the book's quality permits current use. Session statistics (volume, trades) require the same checks plus a session dated today while open.

`MarketDataAvailability.State` drives the availability banner: `offline`, `unknownCalendar`, `historical` (closed but something to show), `available`, `partial`, `sourceUnavailable`, `delayed`, `unavailable`, with counts from the server coverage (`session_quote_count` / `reference_price_count` / `missing_price_count` / `active_instrument_count`, mutually exclusive and validated) when present.

Source freshness string (`MarketSourceMetadata.freshness`): `unknown` when trading date / collected / published are missing; `stale` when not today's session, timestamps out of order, or the last observation is older than 120 s (10 min when only `collected_at` is known); else `delayed` (the feed is never labelled real-time).

### 6.4 Foreground / background lifecycle

- Leaving the foreground: `MarketStore.suspendCurrentQuotes(preservingContent: true)` cancels all in-flight market reads, bumps a generation counter (late responses are discarded), keeps the last snapshot on screen re-assessed by the policy, and marks "awaiting foreground refresh"; `HomeMarketStore.suspend()`, `PortfolioStore.suspendReads()`.
- Returning: calendar + snapshot (+ index on first load) are requested together; the cached closing references may appear as soon as the calendar confirms a known state; watchlist membership, index, realtime listener, portfolio poll and intelligence refresh restart.
- Two-phase load: phase 1 = light snapshot (no histories); phase 2 = index history and per-screen histories on demand. History per security is refetched only when the Luanda day or that security's close/reference inputs change, or after 300 s.
- Background: `BGAppRefreshTask` `com.josetone.investao.widget-refresh` (earliest begin = widget snapshot's `nextRefresh`: 30 min while open/opening-soon and fresh, else 2 h) and silent pushes with `kind: refresh` both run `refreshWidgetData()`: restore session, forced market load, index, widget histories, then (signed in) watchlist and portfolio. Skipped during server maintenance.

### 6.5 `UserDefaults` keys (standard suite unless noted)

`investao.onboarding.completed`, `.pendingSubscriptionOffer`, `.profile`, `.goals`, `.securities`, `.requestNotifications`, `.preferencesApplied.<uid>`; `investao.accountSetup.rolloutDate`, `investao.accountSetup.<uid>.completed|draft`; `investao.notifications.apnsToken`, `investao.notifications.installationID`; `investao.posthog.installation-id.v1`, `investao.posthog.update-policy.v1.<env>.<token>`, `investao.posthog.maintenance.v1.<env>.<token>`; `investao.portfolio.selection`; `investao.search.recentSecurityIDs`; `investao.settings.priceAlertsEnabled|marketMovementNotificationsEnabled|marketInformationNotificationsEnabled`; `investao.income.reminders` (+ `investao.income.*`); `investao.liveActivity.marketSession`; `investao.learn.read`; `investao.bondTerms`; `investao.marketListing.revealed.*`, `investao.marketListing.visible.v2.*`; `investao.reviews.progress.v1`; `investao.subscriptions.pendingGift.<uid>`; `investao.watchlist.group*`; appearance key `AppAppearance.storageKey`; App Group suite: `investao.privacy.enabled`, `investao.privacy.scopeExplained`, `investao.privacy.widgetFinancialDisclosure`, debug `investao.debug.widgetPreviewScenario`.

---

## 7. Push notifications

Files: `Invest.AO/App/PushNotificationAppDelegate.swift`, `Core/Notifications/PushNotificationRegistrar.swift`, `App/PendingNotificationRoute.swift`, `Core/ProductVoice/NotificationPayloadValidation.swift`, routing in `App/ApplicationShell.swift`.

### 7.1 Permission

Never requested at launch. `requestAuthorization(options: [.alert, .badge, .sound])` is triggered by explicit user intent: Settings notification row (when status is not determined), creating an alert / enabling automatic movement alerts in the alert sheet, the asset-detail follow action, and adding to the watchlist. When already authorized (`authorized`, `provisional`, `ephemeral`), the app calls `registerForRemoteNotifications()` on every activation. When denied, the UI deep-links to the system notification settings. No provisional authorization request, no notification categories/actions are registered.

### 7.2 Registration contract (`register-device`, Edge Function, signed-in)

| JSON field | Type | Value |
|---|---|---|
| `deviceId` | String | installation UUID (lowercase), created once and stored in `investao.notifications.installationID` |
| `apnsToken` | String | APNs token as lowercase hex (also stored in `investao.notifications.apnsToken`) |
| `bundleId` | String | app bundle id (backend accepts only `ao.invest.iosapp`) |
| `environment` | String | `sandbox` (APS `development`) or `production` |
| `appVersion` | String? | `CFBundleShortVersionString` |
| `buildNumber` | String? | `CFBundleVersion` |
| `notificationsEnabled` | Bool | current authorization status |
| `marketRecapCapable` | Bool | `true` |
| `notificationPayloadVersion` | Int | `2` |
| `notificationLocalizationVersion` | Int | `1` |
| `unusualActivityCapable` | Bool | `true` |
| `dailyCloseCapable` | Bool | `true` |
| `notificationLanguage` | String | app language code (`pt` or `en`); the server renders alert text in this language |

`unregister-device` body: `{ "deviceId": "<installation id>" }`.

Registrar rules (`SupabasePushNotificationRegistrar`, an actor): only the latest registration intent is kept; one in-flight send at a time; a failed send is kept and retried on the next trigger (every activation, every 30 s tick of the signed-in root task while active, and after sign-in); sends are skipped unless the session user equals the user captured at start; after `unregister` the user is "blocked" from re-registration until `beginAuthenticatedSession()` (next signed-in root). A new sign-in on the same installation re-registers and thereby transfers the installation to the new owner. When permission is revoked the stored token is re-sent with `notificationsEnabled: false`.

A second platform needs an equivalent contract with an FCM / Web Push token and platform discriminator; the current function is APNs-specific (`apnsToken`, `bundleId`, `environment`): backend support `UNVERIFIED`.

### 7.3 Payload keys consumed

| Key | Type | Meaning / validation |
|---|---|---|
| `notification_schema` | Int | must be `2` when present; absence = legacy payload |
| `notification_id` | UUID string | account notification id (schema 2, required) |
| `user_id` | UUID string | intended account; the push is presented/routed only if it equals the signed-in user |
| `category` | String | one of `asset_movement`, `market_listing`, `market_recap`, `news_publication`, `portfolio_daily`, `weekly_wrap`, `unusual_activity`, `daily_close` |
| `preview_class` | String | `generic` or `public_market`. `generic` (and always `portfolio_daily`) must carry exactly the generic copy: "Nova informação em invest.ao" / "Abra a aplicação para consultar a atualização." or "New information in invest.ao" / "Open the app to view the update." |
| `copy_catalogue_version` | String | `legacy` or the bundled voice catalogue version (`1.0.0`) |
| `security_id` | UUID string | required for instrument categories; must be absent for `daily_close`; optional for `unusual_activity` (absent = session digest) |
| `article_id` | UUID string | required for `market_recap` / `news_publication` |
| `recap_receipt_id` | UUID string | legacy recap receipt to mark read |
| `market_event_id` | UUID string | listing event (personalisation signal `listing:<id>`) |
| `wrap_period` | String | `weekly-YYYY-MM-DD` (a Luanda Monday); required for and exclusive to `weekly_wrap` |
| `kind` | String | `refresh` on silent background pushes (no alert) |
| `legacy_delivery_id`, `personalization` | UUID string / object | read for foreground de-duplication (`delivery:<id>`, `account:<id>`, fact key) |
| `aps` | object | standard |

Schema-2 payloads are rejected if they contain any key outside `aps, notification_schema, notification_id, user_id, category, preview_class, security_id, article_id, recap_receipt_id, market_event_id, copy_catalogue_version, wrap_period`, or if title > 100 / body > 250 Unicode scalars. (Consequently `legacy_delivery_id` / `personalization` can only appear on legacy payloads, which are only presented when they carry the generic copy — as read from the code; `UNVERIFIED` against real server payloads.)

### 7.4 Presentation and routing

- Foreground (`willPresent`): shown as banner + list + sound only if validation passes, `user_id` matches the session, and the presentation keys were not already claimed (`ContentExposureStore.claimNotificationPresentation`, exact redelivery stays silent). Also triggers `alertsStore.load()` to refresh the inbox.
- Tap (`didReceive`): `acceptsOpen` (schema-2 full validation; legacy needs a valid `user_id` plus a valid `security_id`, `article_id` or `wrap_period`) -> `PendingNotificationRoute.shared.receive(payload)`; records an "opened" exposure for personalisation.
- Route resolution (`ApplicationShell.resolveNotificationRoute`), executed once the shell exists, the user matches and market data is loaded (cold and warm start share this path because the route is a retained observable):

| Payload | Destination |
|---|---|
| schema 2, `weekly_wrap` | Home tab -> weekly wrap player for `wrap_period` (availability re-checked with the server) |
| schema 2, other categories | fetch the `account_notifications` row (N9), ingest it into Activity Center, queue an "opened" acknowledgement (N6), then route by the record in this order: content unavailable -> error `missingData`; wrap period key -> weekly wrap; frozen portfolio insight -> portfolio insight detail sheet; unusual-activity digest -> unusual activity screen; `daily_close` -> no navigation; article id -> article detail; security id -> asset detail; otherwise error `unavailableInstrument` (op `notification.route`) |
| legacy `wrap_period` | weekly wrap |
| legacy `article_id` (+ `recap_receipt_id`) | article detail; marks the recap receipt read |
| legacy `security_id` | asset detail; unknown instrument -> error `unavailableInstrument`, op `notification.route` |
| route for another user or while signed out | held/dropped (no navigation) |

- Silent push: `kind == "refresh"` -> `refreshWidgetData()` (6.4), returns `.newData`; anything else `.noData`.
- Badge: only ever reset to 0 by the client (sign-out, expiry, deletion).

### 7.5 Local notifications and Live Activity

- Income reminders (`Features/Portfolio/IncomeReminderScheduler.swift`, Plus, toggle `investao.income.reminders`): local notifications scheduled from the income calendar; identifiers and timing not examined in depth: `UNVERIFIED`.
- Live Activity `MarketSessionActivityAttributes(venue: "BODIVA")` with state `{ opensAt, closesAt }`, started locally (no push token) when the user enabled `investao.liveActivity.marketSession`, today is a trading day and the session has not closed; stale date = close; ended otherwise. Carries calendar times only, never prices.

### 7.6 Preference sync

Server-side delivery preferences live in the tables of section 3.5 and are written directly from the settings screens; the notification language is synced through `register-device` on every registration.

---

## 8. Subscriptions

Files: `Invest.AO/Core/Subscriptions/SubscriptionStore.swift`, `SubscriptionAccess.swift`, `Referral.swift`, `LifetimePlusGift.swift`, `Invest.AO/Features/Subscriptions/*`; docs `docs/subscription-foundation.md`, `docs/subscription-rollout-1.1.1.md`.

### 8.1 Stack

The purchase stack is **RevenueCat** (`Purchases` SDK 5.96.0), not hand-written StoreKit 2 code. StoreKit is used directly only for the review prompt. "SDK state controls billing presentation; the backend independently authorizes protected actions."

| Item | Value |
|---|---|
| Kill switch | Info.plist `InvestAOSubscriptionsEnabled == "YES"` (Release). When off: store status `notConfigured`, no RevenueCat configuration, **all Plus/Pro features unlocked** |
| SDK key | Info.plist `InvestAORevenueCatPublicKey`; must start with `appl_` |
| App user id | `Purchases.logIn(<Supabase user id, lowercase UUID string>)`; `logOut()` on sign-out when not anonymous. Every purchase/restore/load is guarded by `Purchases.shared.appUserID == userID` |
| Offering | `offerings.all["default"]`; packages kept only if (`monthly` package and product id == tier monthly id) or (`annual` package and product id == tier annual id) |
| Product ids | Plus: `ao.invest.plus.monthly`, `ao.invest.plus.annual`; Pro: `ao.invest.pro.monthly`, `ao.invest.pro.annual` |
| Entitlement ids | `plus`, `pro` (`info.entitlements.active`); Pro implies Plus status |
| Trial | "7-day free trial" badge only if RevenueCat reports intro eligibility for the product and the intro offer is a free trial totalling 7 days (7 x day or 1 x week) |
| Restore | `Purchases.restorePurchases()`; "no active subscription" message if still free |
| Manage / cancel | external link `https://apps.apple.com/account/subscriptions` |
| Terms | Apple standard EULA `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`; privacy `https://invest.ao/policy` |
| Promo codes / offer codes | none in code |

### 8.2 Tier model and server snapshot

Tiers: free, Plus, Pro. The server snapshot `SubscriptionAccess` (RPC `get_subscription_access`, also returned by `select_free_watchlist` and `authorize_chart_comparison`):

| JSON key | Type | Meaning |
|---|---|---|
| `is_plus` | Bool | Plus access (purchase, referral credit or lifetime gift) |
| `is_pro` | Bool? | Pro access; missing on backends that predate Pro |
| `enforcement_enabled` | Bool | server-side limits are live. `unlocksPlusFeatures` / `unlocksProFeatures` are **true for everyone** unless billing is enabled, a snapshot is loaded and enforcement is on |
| `lifetime_gift` | `{ id: UUID, owner_name: String }`? | lifetime Plus gift; server-authorized, works even if the store is down |
| `plus_credit_until` | String? | end of Plus earned through referrals (no purchase) |
| `week_start`, `resets_at` | String | free-plan weekly window (comparison pair) |
| `comparison_pair` | [String]? | the free plan's comparison pair for this week |
| `active_watchlist_ids` | [String] | the free plan's active watchlist instruments |
| `movement_security_id` | String? | the free plan's single automatic-movement instrument |

Sync sequence (`loadOnce`): `get_subscription_access` -> (if lifetime gift: stop) -> RevenueCat `customerInfo()` -> offerings + trial eligibility (catalogue failure tolerated) -> if a sync is pending: Edge Function `sync-subscription` (POST, no body; the server pulls the truth from RevenueCat for the JWT's user) -> `get_subscription_access` again. If the server's `is_plus`/`is_pro` disagrees with the SDK (and it is not referral credit), a "syncing" message is shown and another sync is requested. A sync is requested after login, purchase, restore, any customer-info change (status, Pro flag or expiry), and at most every 300 s on app activation (`refresh()`). `customerInfoStream` is observed while signed in. All results are dropped if the account changed (generation token). Nothing is cached across launches; offline -> status `unavailable` + message, last in-memory access kept.

Android (Google Play Billing) and web (no IAP) would need `sync-subscription`/the RevenueCat project to recognise purchases from those stores, or the backend to accept another source of truth: `UNVERIFIED`.

### 8.3 Gating table (every gate found in code)

Client gates use `unlocksPlusFeatures` / `unlocksProFeatures` and open the paywall via `requestUpgrade(reason)`; the action resumes automatically after a successful upgrade. Server gates arrive as PostgREST error **messages**.

| Feature | Reason (`UpgradeReason`) | Tier | Free limit | Enforced | File |
|---|---|---|---|---|---|
| Watchlist size | `watchlist` | Plus | `FreePlanLimits.watchlist = 3` | server: `FREE_WATCHLIST_LIMIT` on insert (retry after upgrade); free users pick active instruments via `select_free_watchlist` | `MarketStore.swift`, `SubscriptionManagementView.swift` |
| Automatic movement alerts per instrument | `movement` | Plus | `movementInstruments = 1` | server: `FREE_MOVEMENT_LIMIT` | `Features/Alerts/MarketAlertSheet.swift:390` |
| Number of price alerts | `alerts` | Plus | 2 alerts (client check `alerts.count >= 2` when creating) | client (`UNVERIFIED` server) | `MarketAlertSheet.swift:406` |
| Chart comparison | `comparison` | Plus | 2 instruments, one pair per week; Plus 3 (`plusComparisonInstruments`) | server: `authorize_chart_comparison` (`FREE_COMPARISON_SIZE_LIMIT`, `FREE_COMPARISON_WEEK_LIMIT`, `COMPARISON_DATA_UNAVAILABLE`); never bypassed on failure | `ChartComparisonControls.swift`, `SubscriptionStore.authorizeComparison` |
| Full price history range ("Tudo") | `history` | Plus | other ranges free | client | `Core/Components/TimeRangePicker.swift:120` |
| Price history CSV export | `priceExport` | Plus | - | client | `AssetDetailsView.swift:118` |
| Liquidity profile | `liquidity` | Plus | - | client | `AssetLiquiditySection.swift` |
| Order book depth | `orderBookDepth` | **Pro** | `orderBookLevels = 5` levels | client | `AssetDetailsView.swift:377` |
| Watchlist groups | `watchlistGroups` | Plus | none | client + server `PLUS_REQUIRED` | `WatchlistView.swift`, `WatchlistGroups.swift` |
| Additional portfolios (books) | `portfolios` | Plus | main portfolio only | client + server `PLUS_REQUIRED` | `PortfolioBookMenu.swift`, `PortfolioBooks.swift` |
| Cash movements | `cash` | Plus | - | client + server `PLUS_REQUIRED` | `PortfolioCashSection.swift`, `PortfolioCash.swift` |
| Income calendar + reminders | `income` | Plus | - | client | `IncomeCalendarView.swift` |
| Benchmark comparison | `benchmark` | Plus | - | client | `PortfolioBenchmarkSection.swift` |
| Statement import | `statementImport` | Plus | CSV import/export free | client | `PortfolioTransferViews.swift:27` |
| Annual (tax) report export | `taxReport` | Plus | - | client | `PortfolioResultsSection.swift` |
| Portfolio share links ("client views") | `clientViews` | **Pro** | - | client + server `PRO_REQUIRED`, `SHARE_LIMIT` | `PortfolioBookMenu.swift:67`, `PortfolioShares.swift` |
| Post-onboarding offer | `onboarding` | Plus | - | presentation only (`investao.onboarding.pendingSubscriptionOffer`) | `AuthenticatedAccountRootView.swift` |

### 8.4 Lifetime gift and referrals

- Gift: when `lifetime_gift` is present (Release only), `claim_lifetime_plus_announcement` returns the gift once; it is persisted in `investao.subscriptions.pendingGift.<uid>` until the announcement sheet has actually been shown.
- Referrals: `get_referral` -> `{ code, can_redeem, credit_until }` or null when closed. Share text (localized): "Usa o meu código {code} no invest.ao e ganha 1 mês de Plus. {link}" / "Use my code {code} on invest.ao to get 1 month of Plus. {link}" with link `https://apps.apple.com/app/id6812907673` (a second client should share its own store / web link). `redeem_referral_code(referral_code)`; failures mapped from the error message (3.12 B7). Credit surfaces as `plus_credit_until` and `is_plus`.

---

## 9. Telemetry & flags

### 9.1 PostHog (`Invest.AO/Core/Telemetry/AppTelemetry.swift`, doc `docs/POSTHOG_TELEMETRY.md`)

Enabled in Release automatically; in Debug only with launch argument `--posthog-smoke-test`; never in Xcode previews. Requires a token with prefix `phc_` and host `https://us.i.posthog.com` or `https://eu.i.posthog.com`.

Configuration: bootstrap distinct id = **installation id** (random lowercase UUID in `investao.posthog.installation-id.v1`), `isIdentifiedId: false`; `personProfiles = .never`; no default person properties; GeoIP disabled; application lifecycle events on; screen autocapture, element interactions, autocapture text, push subscription/open capture, swizzling, session replay, surveys, rage clicks, logs, feature-flag preloading and `$feature_flag_called` events all **off**; error autocapture off (Sentry owns crash handlers). The user is **never identified** (`identify` is not called; no account id, email or financial value is ever sent).

`beforeSend` passes every event through `TelemetryPrivacy.sanitize`, which drops any event not in the allow-list and rebuilds properties from scratch:

| Event | Properties | Trigger |
|---|---|---|
| `Application Installed`, `Application Updated`, `Application Opened`, `Application Backgrounded` | SDK metadata only | SDK lifecycle |
| `$screen` | `$screen_name` in {`onboarding`, `home`, `markets`, `portfolio`, `watchlist`, `search`, `authentication`, `settings`, `subscriptions`, `asset_details`, `force_update`, `maintenance`} | tab change (`ApplicationShell`), `onAppear` of Settings, Force update, Maintenance, Asset details, Subscriptions, Authentication, Onboarding |
| `onboarding_started` | - | introduction carousel appears |
| `onboarding_step_viewed` | `onboarding_step` in {`market`, `watchlist`, `portfolio`} | carousel page shown |
| `onboarding_completed` | `completion_method` in {`skipped`, `completed`} | carousel finished |
| `$exception` | `error_category` (only `server`, `serviceUnavailable`, `decoding`, `invalidResponse`, `invalidState`, `unknown`), `operation_domain` (first segment of the operation name if in {market, portfolio, watchlist, auth, account, alerts, push, widgets, news, subscriptions, intelligence, diagnostics}, else `application`), `http_status` (100–599), sanitized `$exception_list` (type `InvestAO.<category>`, value = category, stack frames reduced to addresses/function/module/basename, max 8 exceptions x 100 frames), sanitized `$debug_images` | every `AppError` recorded by `AppErrorLogger`, rate-limited |
| `telemetry_verification` | `verification: true` | Debug smoke test only |

Every event also gets `schema_version: 1`, `environment` (`production` | `development`), `platform: "ios"`, `$geoip_disable: true`, `$process_person_profile: false`, `$is_identified: false`, and only these SDK fields: `$lib`, `$lib_version`, `$os_name`, `$os_version`, `$device_manufacturer`, `$device_model`, `$app_version`, `$app_build`, `$app_namespace`, `$session_id`, `$exception_level`, `$release`.

Error rate limit (`TelemetryErrorLimiter`): max 20 reports per hour, and one per (category, operation domain) per 60 s.

A second client should use `platform: "android"` / `"web"` with the same event names, allow-list and limits so dashboards stay comparable.

### 9.2 Sentry (`InvestAOApp.init`)

DSN is hard-coded in source (config name: Sentry DSN for project `investao/invest-ao-ios`; a new client needs its own project). Options: `sendDefaultPii = false`, auto breadcrumbs off, network breadcrumbs off, environment `development` (Debug) / `production` (Release); no tracing, profiling, screenshots or replay. Skipped in previews and synthetic preview hosts. Debug `--sentry-smoke-test` sends message "invest.ao iOS Sentry verification". dSYM upload: archive build phase `scripts/upload-sentry-symbols.sh` (needs `SENTRY_AUTH_TOKEN`).

### 9.3 Remote flags via PostHog (`Core/FeatureFlags`, doc `docs/POSTHOG_FEATURE_FLAGS.md`)

Fetched with the app's own HTTP call (3.12 B9), not the SDK; works in Debug without telemetry.

| Flag key (production / development) | Payload | Effect |
|---|---|---|
| `ios-force-update` / `ios-force-update-development` | JSON string `{ "minimum_version": "x[.y[.z]]" }` | Blocks the app with the force-update screen when installed marketing version < minimum (numeric comparison of up to 3 components, each <= 6 digits, missing components = 0; build numbers ignored). Store link `https://apps.apple.com/app/id6812907673` |
| `ios-maintenance` / `ios-maintenance-development` | none (enabled flag) | Blocks the app with the maintenance screen (update gate wins if both) |

Rules: refresh at most every 300 s (5 s when forced by the user); a successful response is cached in `UserDefaults` for **3600 s** per environment+token; after the cache expires without a successful fetch the gate **opens** (fail-open); an enabled update flag with an invalid payload neither applies nor renews the previous policy; responses with `errorsWhileComputingFlags` or `quotaLimited` containing `feature_flags` are treated as failures. Default when unreachable and uncached: no gate. Android/web need their own flag keys (e.g. `android-force-update`): `UNVERIFIED` naming.

Server-driven client control independent of PostHog: `control { maintenance, min_poll_seconds }` in the market snapshot (3.1.4) — slows polling but does not block the UI.

### 9.4 Local toggles

Info.plist: `InvestAOCompactHomeEnabled` (false), `InvestAOAppleSignInEnabled` (true), `InvestAOSubscriptionsEnabled`. Debug-only launch arguments: `--posthog-smoke-test`, `--sentry-smoke-test`, `--home-compact-preview`, `--news-preview`, `--news-story-preview`, `--quote-availability-preview` (+ `--availability-light`), `--unusual-activity-preview`, `--listing-preview` (+ `--listing-confirmed|recent|large|no-logo|details|seen|reduce-motion`), `--lifetime-gift-preview`, `--subscription-preview` (+ `--subscription-large`), `--design-preview` (+ `--design-light|dark`), `--onboarding-ui-test`, `--onboarding-flow-preview`, `--civil-date-ui-test`, `--watchlist-undo-ui-test`, `--components-ui-test`, `--privacy-ui-test`, `--simulation-ui-test`, `--review-prompt-ui-test`, `--widget-preview-scenario <populated|stale|empty|private|single|partial|edge>`.

### 9.5 Intelligence feature controls (`Core/Intelligence/IntelligenceFeatureConfiguration.swift`, `IntelligenceFeatureControlStore.swift`, docs `intelligence-feature-controls-phase19.md`, `intelligence-feature-config.example.json`)

Source: table `intelligence_feature_configuration`, single row `id = true`, column `payload` (JSON):

`schema_version` Int, `version` Int, `minimum_app_build` Int, `effective_at`, `expires_at` (dates), `features` { `<feature key>`: { `enabled` Bool, `kill_switch` Bool, `rollout_percentage` Int, `rollout_salt` String, `audiences` [`production` | `beta` | `internal`] } }.

Feature keys: `insight_engine`, `snapshot_capture`, `market_events`, `weekly_wrap`, `saturday_discover`, `week_ahead`, `personalized_home`, `activity_center`, `intelligence_notifications`, `personalization_engine`, `personalization_v2`, `price_changes`, `watchlist_breadth`, `portfolio_performance`, `portfolio_allocation`, `watchlist_patterns`, `publications`, `notification_watchlist`, `notification_movement`, `notification_market_recap`.

Decision reasons: `enabled`, `localDefault`, `disabled`, `killed`, `cohortExcluded`, `dependencyDisabled`, `untrusted`. Audience is `production` in Release, `internal` in Debug. Rollout cohorts are install-scoped (hash of installation identity and salt; exact hash, local defaults per feature, dependency graph and refresh cadence were not examined line by line: `UNVERIFIED` — port from `IntelligenceFeatureConfiguration.swift`, 274 LOC, pinned by `IntelligenceFeatureControlTests.swift`). The configuration contains no account data.

### 9.6 Intelligence observability and privacy constraints

`IntelligenceObservability` logs to the OS log only (subsystem `ao.invest.app`, category `intelligence-health`) with stage (`validationAssets`, `generatorAdmission`, `insights`, `ranking`, `wrapLoad`, `snapshotWrite`, `activityEligibility`, `activityPersistence`, `weekAheadFetch`, `weekAheadSelection`, `featureConfiguration`, `featureFallback`) and outcome (`attempted`, `succeeded`, `insufficientData`, `failed`, `cancelled`, `cached`, `rejected`, `stale`, `eligible`, `suppressed`) counters — nothing is sent to PostHog (the allow-list has no intelligence events).

Privacy classification (`Core/Privacy/IntelligencePrivacy.swift`, doc `docs/intelligence-privacy-phase16.md`): every insight / wrap story is `publicMarket`, `personalContext` (watchlist-derived) or `privateFinancial` (portfolio-derived). Privacy mode (`investao.privacy.enabled`, shared with widgets) hides personal context and private financial content on in-app surfaces, stops personalisation capture and exposure recording, and blanks widgets; widgets additionally need the explicit "financial disclosure" opt-in (`investao.privacy.widgetFinancialDisclosure`) to show portfolio values. Push previews never carry private financial values (`portfolio_daily` is always the generic copy). Analytics must never include security ids, amounts, account ids or free text — enforced structurally by the allow-list above.

---

## 10. Errors

Files: `Invest.AO/Core/Errors/AppError.swift`, `AppErrorMapper.swift`, `ErrorCoordinator.swift`, `ErrorPresentation.swift`, `AppErrorLogger.swift`; doc `docs/global-error-handling.md`.

### 10.1 Taxonomy

`AppError { category, operation: String, underlyingError?, httpStatus? }` (equality ignores the underlying error). Categories: `offline`, `timeout`, `connectionLost`, `server`, `serviceUnavailable`, `rateLimited`, `unauthenticated`, `sessionExpired`, `unauthorized`, `decoding`, `invalidResponse`, `missingData`, `unavailableInstrument`, `unsupportedOperation`, `validation`, `invalidState`, `unknown`.

- `requiresAuthentication`: `unauthenticated`, `sessionExpired`.
- `canRetry`: `offline`, `timeout`, `connectionLost`, `server`, `serviceUnavailable`, `rateLimited`, `unknown`.
- Cause groups (used to retry/dismiss together): `connectivity` (offline, timeout, connectionLost), `backend` (server, serviceUnavailable), otherwise the category itself.
- Cancellation (`CancellationError`, `URLError.cancelled`) is never an error: mapping returns nil and nothing is shown or logged.

### 10.2 Mapping (`AppErrorMapper.map`)

| Underlying | Category |
|---|---|
| URL error: not connected / cannot find host / DNS failure | `offline` |
| URL error: timed out | `timeout` |
| URL error: connection lost / cannot connect to host | `connectionLost` |
| URL error: bad server response | `invalidResponse` |
| Decoding error | `decoding` |
| Missing account session (`SupabaseAccountSessionError`) | `unauthenticated` |
| HTTP status (HTTP errors, Functions `httpError`, Auth API errors): 401 | `sessionExpired` |
| 403 | `unauthorized` |
| 404 | `missingData` |
| 408, 504 | `timeout` |
| 429 | `rateLimited` |
| 502, 503 | `serviceUnavailable` |
| other 5xx | `server` |
| 400, 409, 422 | `validation` |
| other status | `invalidResponse` |
| Functions relay error | `serviceUnavailable` |
| PostgREST code `PGRST301`, `PGRST302`, `PGRST303` | `sessionExpired` |
| Postgres `42501` | `unauthorized` |
| `PGRST000`–`PGRST003`, `53300`, `57P01`, `57P02`, `57P03` | `serviceUnavailable` |
| `23502`, `23503`, `23505`, `23514`, `22P02` | `validation` |
| any other PostgREST error | `server` |
| Auth error codes `session_not_found`, `session_expired`, `refresh_token_not_found`, `refresh_token_already_used`, `bad_jwt`, JWT verification failure | `sessionExpired` |
| Auth `invalid_credentials`, `weak_password`, `validation_failed`, non-API auth errors | `validation` |
| Auth session missing | `unauthenticated` |
| anything else | `unknown` |

Business-rule signals are carried in the PostgREST error **message** and intercepted before generic mapping: `FREE_WATCHLIST_LIMIT`, `FREE_MOVEMENT_LIMIT`, `FREE_COMPARISON_SIZE_LIMIT`, `FREE_COMPARISON_WEEK_LIMIT`, `COMPARISON_DATA_UNAVAILABLE`, `PLUS_REQUIRED`, `PRO_REQUIRED`, `SHARE_LIMIT`, `REFERRAL_CODE_INVALID`, `REFERRAL_OWN_CODE`, `REFERRAL_ALREADY_USED`, `REFERRAL_NOT_ELIGIBLE`, `REFERRALS_UNAVAILABLE`; Postgres `23505` on named entities = duplicate name. Server retry hint: JSON error body field `retry_after_seconds`.

### 10.3 Presentation and retry

`ErrorPresentation(error, context)` with context `initialLoad` | `refresh` | `action` | `authentication` | `signOut`:

| Decision | Rule |
|---|---|
| Severity | requires auth -> `authenticationRequired`; `invalidState` -> `blocking`; refresh/signOut -> `informational`; else `recoverable` |
| Style | `invalidState` -> alert; refresh/action/signOut -> banner (toast); authentication -> inline; initial load -> full-content error state |
| Retry button | only when `canRetry` and context is not `signOut` |
| Copy | by category (connectivity, permission, unreadable data, unavailable information, validation, unsupported, generic, rate limit); for server/unknown categories a title chosen from the operation name: `market.load`, `market.history`/`market.intraday`, `portfolio.load`, `portfolio.create`/`update`, `portfolio.delete`, `alerts.load`, `chart.export`/`render`, `auth.signOut`, `auth.restore`, `account.delete`, prefixes `watchlist.`, `alert.`, `notification.`, `auth.`; message `errors.service.unavailable`. Backend error text is never shown to users |

`ErrorCoordinator` (one shared instance for market, alerts, portfolio, groups, auth): `handle` maps + logs and, for auth-required errors, clears all entries and raises `requiresAuthentication` (the root view then expires the session and shows sign-in). `present` keeps one entry per operation name (latest wins), shown one cause group at a time. `retryCurrent` retries each failed operation of the visible cause group once, serially; there is **no automatic retry loop**. While a retry is running, stores refuse to start new loads. `reset()` on sign-out / successful re-auth.

Stale-while-error for market data: a failed refresh keeps the loaded snapshot on screen, invalidates its quotes (6.3), sets `refreshError` (banner "refresh failed" / offline banner), and the poll loop continues with backoff. Initial-load failure shows the full error state with retry.

| Backend failure | User-facing state |
|---|---|
| Network unreachable | Offline banner; retained content with quotes downgraded to "last quote"; widgets keep last values and mark stale after 30 min |
| Snapshot function 5xx / timeout | Same as refresh failure; next refreshes use direct table reads for 5 min |
| Calendar invalid / missing | Market status "unavailable"; no current quotes, no cached closes, order book hidden |
| Malformed catalogue row | That instrument silently missing |
| Verified closes view fails | Closing references unavailable, rest of market loads |
| 401 / expired JWT on any call | Session expired -> private state wiped -> sign-in screen with "session expired" message |
| 403 / RLS denial | "Permission denied" (not retryable) |
| 429 | "Too many requests", retryable; market loop honours `retry_after_seconds` |
| Tier limit messages | Paywall for the specific reason, action resumed after upgrade |
| Decoding / contract mismatch | "Data unreadable"; reported to PostHog (category `decoding`) |

Logging path: `AppErrorLogger.record` -> OS log + `AppErrorReporter` -> PostHog `$exception` (sanitized, rate-limited). Sentry receives only native crashes.

Operation-name families in use (for telemetry domain and copy selection): `market.*` (`load`, `index`, `watchlist`, `history`, `intraday`, `detail.<section>`, `homeProjection`, `homeContract`, `homeDeadline`, `homeEligibility`, `calendar*`, `snapshotContract`, `orderBook`), `supabase.*` (repository-level names listed in section 3), `portfolio.*`, `benchmark.rates`, `income.dividends`, `alerts.load`, `alert.*`, `watchlist.*`, `notification.route`, `widget.route`, `widgets.scheduleRefresh`, `auth.*` (`signIn`, `signInWithApple`, `signOut`, `restore`, `expireSession`, `clearSession`, `appleCredentialState`, `google.authorize`, `google.token`), `account.*` (`delete`, `appleAuthorization`, `delete.clearSession|clearCache|wrapHistory|clearBadge`), `onboarding.save`, `push.*` (`permission`, `register`, `registrationFailed`, `unregisterOnLogout`, `unregisterOnExpiry`), `unusualActivity.*`, `wrap.*`, `cache.load|save`, `simulation.fetchSnapshot`, `chart.export|render`, `telemetry.verification`.

---

## 11. Links

### 11.1 Inbound

There are **no universal links / associated domains**. Everything inbound is the custom scheme `investao://` (Release) or `investao-dev://` (Debug), handled by `.onOpenURL { PendingNotificationRoute.shared.receiveWidgetURL($0) }`.

| Pattern | Parser | Destination | Notes |
|---|---|---|---|
| `investao://market` | `WidgetDeepLink` (`Core/Widgets/WidgetDeepLink.swift`) | Markets tab | no path, query, port, fragment or credentials allowed |
| `investao://watchlist` | same | Watchlist tab | |
| `investao://portfolio` | same | Portfolio tab | |
| `investao://security?id=<security id>` | same | Asset detail | exactly one query item `id`, 1–128 chars; waits for one live market load before declaring the id unavailable |
| `investao://wrap/weekly-YYYY-MM-DD` | `WeeklyWrapDeepLink` (`Features/WeeklyWrap/Data/WeeklyWrapDeepLink.swift`) | Home -> weekly wrap for that period | key must be 17 chars and the date a Luanda **Monday**; availability is still resolved with the server |
| `investao://auth/callback` | Supabase SDK web auth session | OAuth redirect for the Google web fallback | not routed by `onOpenURL` logic |
| `com.googleusercontent.apps.<client-id-prefix>:/oauth2redirect` | `ASWebAuthenticationSession` callback scheme | native Google sign-in | not registered in Info.plist; captured by the auth session |
| Spotlight result (`CSSearchableItemActionType`, domain `ao.invest.securities`, identifier = security id) | `SpotlightIndex.route` | Asset detail | |
| App Intents / Shortcuts (`App/Intents/InvestAOShortcuts.swift`) | `InstrumentPriceIntent` (answers with a quote snippet), `OpenInstrumentIntent`, `OpenPortfolioIntent`, `OpenWatchlistIntent` | respective screens | Portuguese Siri phrases |
| Widget taps | `WidgetDeepLink.url` | as above | |
| Push notification tap | section 7.4 | | |

A website wishing to deep-link into the iOS app today can only use `investao://…`; adding universal links would require an app release with an associated-domains entitlement and an `apple-app-site-association` file (not present).

### 11.2 Outbound URLs and domains

| URL / pattern | Purpose | Where | Website must serve? |
|---|---|---|---|
| `https://invest.ao/policy` | Privacy policy (Settings; also required support contact per `APPLE_RELEASE_CHECKLIST.md` PRR-006) | `Features/Settings/SettingsView.swift:142` | **Yes** |
| `https://invest.ao/partilha/<token>` | Read-only shared portfolio ("client view"); token from `create_portfolio_share`, shared via the system share sheet | `Features/Portfolio/Data/PortfolioShares.swift:52` | **Yes** — public page that resolves the opaque token server-side (the app has no client code for reading a share; the data contract for the page is `UNVERIFIED`) and must handle revoked tokens |
| `https://apps.apple.com/app/id6812907673` | App Store page: force-update button, referral share text | `ForceUpdateView.swift:59`, `ReferralSection.swift:56` | No (but the website should link it) |
| `https://apps.apple.com/account/subscriptions` | Manage/cancel subscription (Settings delete-account dialog, lifetime gift sheet) | `SettingsView.swift:681`, `LifetimePlusGiftSheet.swift` | No |
| `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` | Terms of use (Apple standard EULA) on the paywall | `SubscriptionManagementView.swift:380` | No — there is **no invest.ao terms page** referenced by the app |
| `app-settings:` / notification settings URLs | iOS Settings (language, notifications) | `SettingsView.swift`, `MarketAlertSheet.swift` | No |
| Issuer websites, financial report URLs, dividend/listing source URLs, news source URLs, links inside article Markdown | External evidence; opened in an in-app Safari view or the system browser; only `https` URLs pass validation | asset details, week ahead, news | No (data-driven) |
| `https://www.bodiva.ao` / `bodiva.ao` | Only accepted hosts for reference-price evidence | `MarketReferencePrice.swift` | No |
| `https://www.google.com/s2/favicons?domain_url=…&sz=128` | Logo fallback | `MarketSecurity.swift`, `SecurityLogoCache.swift` | No |
| `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token` | Google sign-in | `GoogleNativeSignIn.swift` | No |
| `https://fwajbjthzqcdolduaaxm.supabase.co` (`/rest/v1`, `/auth/v1`, `/functions/v1`, `/realtime/v1`) | Backend | `InvestAOSupabase.swift` | No |
| `https://us.i.posthog.com` (`/flags?v=2` + SDK ingestion); Sentry ingestion host | Telemetry | section 9 | No |

No `mailto:` or support URL, no account-deletion web page, no news/article web URL, no weekly-wrap web link and no referral landing URL exist in the client. Account deletion is in-app only (`docs/account-deletion.md`); stores increasingly require a web deletion path, which the website would have to add as new functionality.

Website checklist derived from the client: (1) `GET /policy` — privacy policy with a working support contact; (2) `GET /partilha/{token}` — shared portfolio view; (3) optional but implied: a landing page that links the App Store id `6812907673` and can carry a referral code (the share text only mentions the code in prose).

### 11.3 Share payloads

| Share | Payload |
|---|---|
| Price history export (Plus) | CSV file `invest-ao-<symbol lowercase>-historico.csv` (`PriceHistoryCSV.export`) |
| Portfolio export | CSV file `invest-ao-carteira.csv` (`PortfolioCSV.export`; the same format is accepted by import) |
| Annual report (Plus) | generated report document per year (`PortfolioYearReport.swift`; file type `UNVERIFIED`) |
| Chart comparison | PNG image written to a temporary file (`ChartComparisonExport.swift`) + story-format export view |
| News story | rendered story image (`NewsStoryExporter.swift`) |
| Weekly wrap | share card image and exported video file via the system share sheet (`WeeklyWrapShareCard.swift`, `WeeklyWrapVideoExporter.swift`; AVFoundation, bundled track `weekly-wrap-theme.mp3`) |
| Portfolio share link | the URL `https://invest.ao/partilha/<token>` |
| Referral | localized text with code + App Store link |

---

## 12. Client-side domain logic to port

Scope note: algorithms below were read from code for the market policy, portfolio ledger and simulator. For the intelligence engine, personalisation and product voice this section gives architecture, contracts, constants found and size, but **not** a line-by-line algorithm transcription — those units are marked "port from source + tests" and individual thresholds not listed here are `UNVERIFIED`.

### 12.1 Portfolio computations — all client-side

There is no server valuation. The server stores the ledger and (for notifications only) freezes its own evidence. Files: `Features/Portfolio/Data/PortfolioCalculator.swift` (336 LOC), `PortfolioCash.swift`, `PortfolioBenchmark.swift`, `PortfolioResults.swift`, `PortfolioCSV.swift` (298), `IncomeCalendar.swift` (189), `StatementTextParser.swift` (80), `Core/Intelligence/PortfolioPriceChangeCalculator.swift` (checked Decimal arithmetic), validator `PortfolioInputValidator` in `Core/Market/Domain/Models/DataQuality.swift`.

Ledger contract (`PortfolioTransaction`):

| Field | Type | Rule |
|---|---|---|
| `id` | String (client-generated lowercase UUID) | unique |
| `securityID` | String | non-empty |
| `kind` | `buy` \| `sell` \| `income` | `income` = one gross dividend/coupon payment |
| `quantityValue` | Decimal (`numeric(24,8)`) | > 0; for `income` exactly 1; whole numbers for equities (funds and bonds may be fractional); bonds record **nominal amount** as quantity |
| `unitPriceValue` | Decimal | > 0; for bonds a percentage of nominal (price scale 0.01), for `income` the gross amount |
| `feesValue` | Decimal | >= 0; broker commission, or withheld tax for `income` (must be <= gross) |
| `tradedOn` | civil day (stored as 12:00 Luanda) | not after today (Luanda) |
| `createdAt` | instant | server timestamp, tie-breaker |
| `portfolioID` | String? | nil = main portfolio |

Ordering: trading day, then `createdAt`, then `id`. Instruments allowed in a ledger: equities, funds, treasury and corporate bonds.

Algorithm (average cost, per security, all in `Decimal`, any arithmetic failure or an oversell invalidates the **whole** computation and returns nothing):

- Buy: `cost = quantity x unitPrice x priceScale + fees`; `quantity += q`; `invested += cost`.
- Sell: requires `q <= held`; `avg = invested / held`; `soldCost = q x avg`; `proceeds = q x unitPrice x priceScale − fees`; `realized += proceeds − soldCost`; `held −= q`; `invested −= soldCost` (forced to 0 when the position closes).
- Income: `net = gross − fees`; `income += net`; quantity unchanged; `withheld = fees`.
- Position: `averagePurchasePrice = invested / quantity / priceScale` (so fees are inside the average).
- Valuation: `currentValue = quantity x price x priceScale`; `unrealized = currentValue − invested`; `return% = unrealized / invested x 100` (0 when invested is 0). The price used is the security's usable current price per the quote policy; positions without one have nil value and are counted in `missingPriceCount`.
- Summary: totals over priced positions only; `return% = P&L / invested(priced) x 100`.
- Allocations: only when **every** position is priced; `value / total x 100`, sorted descending.
- Results by year: sum of realized, net income and fees per calendar year (Luanda) of `tradedOn`; year report per instrument adds `withheldTax` and `commissions = fees − withheld`.
- Historical value series: for each day present in the price histories (within the range), sum `remainingQuantity x close x priceScale` over open positions; a day is dropped if any open position lacks a close that day; days with no open position yield 0.
- Cash (Plus): `netDeposited = deposits − withdrawals`; `balance = netDeposited − fees + Σ(sell and income net amounts) − Σ(buy net amounts)`.
- Benchmark (Plus): hypothetical balance of the same cash flows compounded continuously at a reference rate (`value x exp(dailyRate x days)`), rates from `market_rates` named `Inflação Homóloga`, `Taxa Básica do BNA`, `Taxa LUIBOR Overnight`, `BTs - 364 Dias`.

Contract fixture: `Tests/MarketDiscoveryTests/PortfolioContractFixtures/portfolio-ledger.v1.json` (golden cases, decimals as strings; refers to `docs/portfolio-ledger-contract.md`, which is **not present** in the snapshot). Directly reusable as a cross-platform contract test.

CSV import/export, statement parsing, income calendar and reminders, bond yield (`Core/Market/Domain/Models/BondYield.swift`, 156 LOC), liquidity profile (`LiquidityProfile.swift`, 50), chart comparison maths (`Core/Charts/ChartComparisonMath.swift`, 133) and price-history CSV (`PriceHistoryCSV.swift`, 31) are pure functions with dedicated tests; their exact formats/formulas were not transcribed here: `UNVERIFIED` — port from source with `PortfolioCSVTests`, `BondYieldTests`, `LiquidityProfileTests`, `ChartComparisonMathTests`.

### 12.2 Investment simulator (`Features/Simulation/Models/InvestmentSimulation.swift`, 279 LOC; doc `docs/investment-simulator.md`)

Pure, deterministic, `Decimal`-based hypothetical projection; no backend computation.

Inputs (`SimulationInput`): `initialInvestment`, `monthlyContribution` (each 0…1,000,000,000,000), `annualReturnPercent` (> −100 and <= 100), `durationMonths` (1…600). Optional `SimulationInstrument`: `unitPrice` (> 0, from a fresh authenticated market snapshot), `allowsFractionalQuantity`.

Generic mode: month 0 = initial amount; each month `balance = balance x g + monthlyContribution` (growth first, contribution at month end); `contributions += monthlyContribution`.

Instrument mode: buy units with the initial amount at the current price (whole units rounded **down** unless fractional is allowed; cost rounded down; remainder kept as cash without interest); each month `price = price x g`, then buy with `cash + monthlyContribution`; `balance = quantity x price + cash`. No dividends, fees, taxes or inflation.

Monthly growth factor `g`: 1 when the rate is 0; otherwise `1 + expm1(ln(1 + r) / 12)` where `ln(1+r)` is `log1p(r)` for `r >= −0.5` and `log(decimal growth)` below that; computed in double precision once, converted to `Decimal` through its shortest string, treated as 1 when `|rate| < 1e−128`. Multiplication/division go through checked significand arithmetic to avoid `Decimal` exponent wrap; overflow or a non-monotonic result throws `arithmeticOverflow`. No currency rounding inside the projection; rounding is presentation-only. Output: monthly points (`month`, `balance`, `contributions`, and in instrument mode `quantity`, `unitPrice`, `cash`), final balance, total contributions, initial/final quantity, final unit price, uninvested cash.

Porting note: results must match to the last digit only if the target uses an equivalent 38-digit decimal type and the same double-precision `log1p`/`expm1`; share test vectors from `InvestmentSimulationTests`, `AssetInvestmentSimulationTests`, `SimulationDraftTests`. Draft persistence and number parsing: `SimulationDraft.swift`, `Core/Formatting/SimulationNumberParser.swift`.

### 12.3 Intelligence engine (`Core/Intelligence`, 31 files, about 4,300 LOC; docs `intelligence-foundation.md`, `portfolio-insight-catalog.md`, `watchlist-insight-catalog.md`, `insight-lifecycle-phase13.md`, `historical-intelligence-snapshots-phase14.md`, `offline-cached-intelligence-phase17.md`, `intelligence-evaluation-phase20.md`)

Runs entirely on device, for signed-in users. Pipeline: verified evidence -> `FinancialFact` -> `Insight` -> product-voice copy -> personalised ranking -> surfaces (Home context card, Watchlist section, Portfolio section, Activity Center, Weekly wrap, Week ahead, Saturday discover).

Inputs (`InsightInput`): `period` (a civil week from the calendar), `generatedAt`, `fetchedAt`, `calendar`, `observations` (`InsightPriceObservation`: record id, asset id, 3-letter currency, Decimal price, observedAt = session close, collectedAt, source dataset + ingestion run id + 64-hex content hash + parser version, `isFinal`, `dataQuality`), `watchlistIDs`, `portfolioIDs`, `activityAssetIDs`, optional portfolio input (ledger, security metadata, fetch times) and publications input. Evidence comes from `get_market_period_evidence` (3.9), never from chart points.

Gates: `InsightFreshnessPolicy` (fetch age < 15 min, period ended < 7 days ago); `HistoricalSeriesValidator` (calendar present, >= 2 sessions, last session closed, exactly one final observation per expected session close, single currency, full provenance, no duplicates) producing a per-asset `DataQualityReport`; `PortfolioInputValidator` (valid ledger, AOA only, unit-valued instruments, whole quantities where required); remote feature controls (9.5); privacy policy (9.6).

Insight types (`InsightType`): `assetPriceChange`, `watchlistBreadth`, `portfolioPricePerformance`, `portfolioAllocation`, `watchlistMovement`, `watchlistSessionRun`, `watchlistClosingExtreme`, `watchlistInformation`, `marketInformation`. Categories `market` | `watchlist` | `portfolio`; destinations asset / watchlist / portfolio / information(article).

Catalogues as documented and implemented: Watchlist (5): strongest weekly quote movement, advancing/declining watched securities, ending positive/negative session run, closing high/low of the observed period, newly published linked information. Portfolio (9): weekly price performance, absolute weekly value change attributable to prices, strongest and weakest monetary contributor, allocation by asset / issuer / issuer sector, largest position (descriptive concentration), counts of advancing/declining/unchanged holdings.

Constants found: `WatchlistSignificance.minimumMovement = 1` (%), `minimumRun = 3` sessions, `minimumExtremeObservations = 5`, `publicationAge = 7 days`; `InsightSignificance.significantMovement = 3` (%), `materialMovement = 5` (%), `concentrationDisclosure = 50` (%).

`Insight` (Codable; cached and frozen): `id` (stable semantic identity), `type`, `category`, `fact`, `generatedAt`, `period`, `expiresAt`, `relatedAssetIDs`, `relevance`, `destination`, `provenance` (`calculationID`, `calculationVersion`, `calendarVersion`, observations, `fetchedAt`, completeness, optional portfolio / publication evidence), optional `serverNotificationID`, optional `voiceComposition`.

Caching/offline (`IntelligenceCache`, `CachedIntelligence`): per user and kind (`portfolio`, `watchlist`, `weekAhead`) JSON under Application Support, max 2 MiB, expires 7 days after fetch (24 h for week ahead), invalidated when the ledger fingerprint, watched set or market fingerprint changes; writes are guarded by a lease so a result computed before an invalidation is not saved. Where it runs: `WatchlistInsightCoordinator` (every 60 s while active), `PortfolioInsightCoordinator`, `HomeContextCoordinator`, `VerifiedWeeklyWrapService/Loader`, `SaturdayDiscoverCoordinator`, `WeekAheadCoordinator`; all re-check `auth.userID` after every await.

Evaluation harness: `IntelligenceEvaluationTests` exports `intelligence-evaluation.json` (env `INTELLIGENCE_EVALUATION_OUTPUT`), compared between branches by `scripts/compare-intelligence-evaluations.py` in CI.

### 12.4 Personalisation (`Core/Personalisation`, 13 files, about 1,990 LOC; docs `PERSONALIZATION_DECISIONS.md`, `user-feedback-personalization-phase21.md`)

Local, per signed-in user, disabled in privacy mode. Signals recorded (`PersonalisationEvent`): asset viewed, search result selected, comparison created, chart range selected, watchlist add/remove, wrap opened, weekly-wrap lifecycle events; aggregated per installation and Luanda day into counters and synced through `user_activity_daily` (3.10). `UserInterestProfile` derives interest per security from those aggregates plus held, watched and alert sets; `PersonalizationEngine` (330 LOC) scores `PersonalizationCandidate`s using `PersonalizationConfiguration` weights (119 LOC), explicit feedback (`PersonalizationFeedback`), exposure history (`ContentExposureStore`: shown/opened per surface, notification presentation claims) and a ranking cache; it reorders insights, notifications (`NotificationPersonalization.Qualification`, also sent by the server in the legacy push `personalization` key) and weekly-wrap stories. Versions selectable remotely: `significance` (no personalisation), `v1`, `v2`. Weights and decay constants: `UNVERIFIED` (port from source; pinned by `PersonalizationEngineTests`, `PersonalisationTests`).

### 12.5 Product voice (`Core/ProductVoice`, 7 Swift files about 890 LOC + `catalogue.v1.json` 1,990 lines + `catalogue.v1.sha256`)

Copy for insights and notifications is composed from a versioned catalogue: `schemaVersion: 1`, `catalogueVersion: "1.0.0"`, `locale: "pt-AO"`, `strategies` (15; id, event families, required capabilities, privacy class), `hooks` (31) and `factClauses` (16) (each: id, `text` with `{placeholder}` slots such as `{issuer}`, `{symbol}`, `{signedPercentage}`, `{comparisonLabel}`; event families, surfaces, directions, significance levels, moods, required capabilities, privacy class, `playful`, `hookFamily`), `closers` (0), `neutralFallbacks` (1: the generic "Nova informação em invest.ao" copy). A `VoiceComposition` records which strategy/hook/fact clause/closer produced a title/body, with `catalogueVersion` and `privacyClass`.

The **server composes notification copy with the same catalogue** (account notification rows carry `composition` / `preview_composition`; push payloads carry `copy_catalogue_version` which must be `legacy` or the bundled version) and the checksum file pins the bundled copy; `VoiceFixtures/parity.v1.json` is a parity fixture between implementations. A second client must ship the identical catalogue (or accept only `legacy`/matching versions) and reproduce selection deterministically to pass parity. English is produced by `VoiceComposition+Localization` and local copy generators (`DailyCloseCopy`, `UnusualActivityCopy`, `InsightVoiceAdapter`), using the string catalogue (`Resources/Localizable.xcstrings`: source language `pt`, localizations `pt` and `en`, 1,989 keys, dotted key scheme `<area>.<screen>.<meaning>`). `LocalProductVoice` stores recent choices per user to avoid repetition.

### 12.6 Other logic units

| Unit | Files / LOC | Notes |
|---|---|---|
| Market calendar + quote policy + data quality | `Core/Market/Domain` (about 2,900 LOC) | Fully specified in sections 3.1 and 6; pure; heavily tested |
| Security kind classification | `Policies/SecurityKindClassification.swift` (61) | Maps `security_type` + name + symbol to equity / fund / treasuryBond / corporateBond / other; `UNVERIFIED` rules |
| Watchlist ordering / undo | `Policies/WatchlistOrdering.swift` (72) | dedupe, reorder merge, restore position |
| Time ranges | `Models/TimeRange.swift` (131) | raw values `1D`, `1S`, `1M`, `3M`, `6M`, `1A`, `Tudo`; day counts 1/7/30/90/180/365/all; a range is available with >= 2 points and span >= max(7, 90% of the range); 1D only on trading days |
| Market discovery (movers, filters) | `Models/MarketDiscovery.swift` (266) | ranks by displayed BODIVA variation |
| Activity policy / archive | `ActivityPolicy.swift` (254), `ActivityArchive.swift` (133) | retention 56 days, max 200 items, merge of server notifications and local insights |
| Week ahead / Saturday discover / Home context | `WeekAheadPolicy.swift` (229), `SaturdayDiscoverRanking.swift` (83), `HomeContextResolver.swift` (291) | selection and priority rules; `UNVERIFIED` details |
| Weekly wrap assembly | `Features/WeeklyWrap/Data` (about 1,750 LOC) | stories: opening, marketIndex, marketBreadth, marketRise, marketFall, watchlist, watchlistHighlight, portfolio, portfolioContributor, personalStat, summary; built client-side from period evidence |
| Unusual activity copy | `UnusualActivityCopy.swift` (266) | local text from `facts` |
| News Markdown subset | `NewsMarkdown.swift` (90) | safe-URL filter, limited syntax |
| Number / date formatting | `Core/Formatting` (about 1,000 LOC) | AOA formatting, Angolan amount editing (comma decimal), percent, civil dates; `UNVERIFIED` exact patterns |
| Review prompt | `Core/Reviews` | eligible after >= 3 completed actions and >= 2 sessions, at most once per 90 days, pending request valid 5 min, new session after 30 min in background |

### 12.7 Portability summary

| Unit | Approx LOC | Pure logic | Shared fixtures / tests | Difficulty |
|---|---|---|---|---|
| Calendar, quote policy, data quality | 2,900 | yes (clock injected) | `MarketCalendarTests`, `CurrentQuotePolicyTests`, `DataQualityTests`, `VerifiedClosingPricesTests`, `MarketReferencePriceTests`, `HomeCompactFixtures/contract.json` | L (subtle) |
| Portfolio ledger maths | 900 | yes | `PortfolioContractFixtures/portfolio-ledger.v1.json`, `PortfolioCalculatorTests` | M |
| Simulator | 500 | yes | `InvestmentSimulationTests` | M (decimal parity) |
| Intelligence engine | 4,300 | yes | `IntelligenceEvaluation*`, `InsightFoundationTests`, `WatchlistIntelligenceTests`, `PortfolioIntelligenceTests` | L |
| Personalisation | 2,000 | mostly (storage) | `PersonalizationEngineTests` | L |
| Product voice | 900 + catalogue | yes | `VoiceFixtures/parity.v1.json`, `ProductVoiceTests` | M |
| Weekly wrap | 1,750 | yes + storage | `VerifiedWeeklyWrapTests`, `WeeklyWrapTests` | L |
| Formatting | 1,000 | yes (locale) | `FinancialPresentationTests`, `AmountInputFormattingTests` | S–M |

---

## 13. Widgets / extensions data flow

Target `InvestAOWidgets` (WidgetKit; kinds `InvestAOMarket`, `InvestAOWatchlist`, `InvestAOSecurity` (configurable via an App Intent that picks an instrument), `InvestAOPortfolio`, plus the `MarketSessionLiveActivity` UI). Doc `docs/home-screen-widgets.md`.

- The extension performs **no network requests and has no Supabase client or credentials**. It only reads JSON files from the App Group container directory `Widgets/` (`market-v1.json`, `watchlist-v1.json`, `portfolio-v1.json`, `owner-v1.json`), each `{ "version": 1, "value": … }`, max 512 KiB, written atomically by the main app only (`WidgetSnapshotStore`, `WidgetSnapshotBridge`).
- Values are pre-formatted display strings produced by the app's formatters (`WidgetQuote`: id, symbol, name, price, change, absoluteChange, percentage, trend series, labels, price date; `WidgetMarketSnapshot`: index value/change/percentage, status, updatedAt, sourceIsStale, quotes, trend, index trading date; `WidgetWatchlistSnapshot`: ownerID, quotes, updatedAt; `WidgetPortfolioSnapshot`: ownerID, value, profitLoss, change, percentage, position/missing counts, holdings, best, worst, updatedAt, `currentQuotesValidUntil`).
- Ownership: private files are readable only when `owner-v1.json` matches their `ownerID`; sign-out/expiry deletes owner + private files first.
- Privacy: privacy mode empties the watchlist widget and masks the portfolio widget; portfolio values need the separate widget financial-disclosure opt-in.
- Writes happen on every published market snapshot, confirmed watchlist change, ledger load and privacy change; the app calls `WidgetCenter.reloadTimelines(ofKind:)` only when a file actually changed. Sparklines come from the hourly 45-day closes read (M14) and are carried over between writes.
- Timeline: entry from cache; next refresh 30 min while market is open/opening-soon and data fresh, else 2 h; market data is "stale" when older than 30 min or flagged by the source; a second entry at `currentQuotesValidUntil` downgrades the portfolio to "no quote".
- Background refresh of the files: section 6.4. Taps: `WidgetDeepLink` URLs (11.1).

Android equivalent: app widgets fed from a local store written by the app process (plus WorkManager for refresh); web has no equivalent.

---

## 14. Testing & fixtures

Coverage descriptions below are inferred from file names and spot checks, not from reading every test: treat per-file descriptions as `UNVERIFIED` detail.

### 14.1 SwiftPM logic tests (`Tests/MarketDiscoveryTests`, 106 Swift files, about 23,200 LOC; run with `swift test`, macOS host)

| Area | Test files |
|---|---|
| Market contracts and decoding | `TolerantMarketDecodingTests`, `MarketSnapshotRouteTests`, `BundledSnapshotExtrasTests`, `HomeCompactContractTests`, `HomeMarketStoreTests`, `MarketHistoryPaginationTests`, `MarketListingTests`, `WrapAvailabilityRepositoryTests`, `SupabaseErrorBoundaryTests`, `PolledReadRetryTests` |
| Calendar, quote policy, freshness | `MarketCalendarTests`, `CurrentQuotePolicyTests`, `DataQualityTests`, `MarketQuoteDateTests`, `MarketSourceFreshnessTests`, `MarketHistoryFreshnessTests`, `VerifiedClosingPricesTests`, `MarketReferencePriceTests`, `QuoteRecoveryTests`, `MarketDisplayMovementTests`, `IntradayMovementTests`, `OrderBookLevelTests` |
| Store behaviour (refresh, backoff, realtime, races) | `MarketAutomaticRefreshTests`, `MarketRefreshBackoffTests`, `QuoteAnnouncementTests`, `MarketTwoPhaseAndCacheTests`, `MarketConnectivityMonitorTests`, `StartupLoadingTests`, `ReadinessRegressionTests`, `CachePerformanceTests`, `HomeEssentialBenchmarkTests`, `MarketWidgetCommitTests`, `WidgetSnapshotTests` |
| Watchlist, alerts | `WatchlistLogicTests`, `WatchlistStoreTests`, `WatchlistUndoTests`, `MarketAlertsStoreTests`, `MarketAlertsLoadRaceTests` |
| Portfolio | `PortfolioLedgerContractTests`, `PortfolioCalculatorTests`, `PortfolioCSVTests`, `PortfolioCivilDateTests`, `PortfolioIdempotentSaveTests`, `PortfolioRefreshTests`, `PortfolioIntelligenceTests` |
| Auth, account, push | `AuthenticationStoreTests`, `SessionRestorationTests`, `AccountDeletionRepositoryTests`, `AccountDeletionStoreTests`, `AccountDeletionLocalDataTests`, `PushNotificationRegistrarTests`, `PostLoginOnboardingTests` |
| Notifications / activity | `ActivityCenterTests`, `NotificationDeliveryMappingTests`, `NotificationFactTests`, `NotificationPresentationClaimTests`, `DailyCloseCopyTests`, `UnusualActivityTests` |
| Intelligence / personalisation / voice | `InsightFoundationTests`, `WatchlistIntelligenceTests`, `IntelligenceCacheTests`, `IntelligenceDebuggerTests`, `IntelligenceFeatureControlTests`, `IntelligenceObservabilityTests`, `IntelligencePrivacyTests`, `IntelligenceEvaluationHarness/Scenario/Tests`, `HomeContextResolverTests`, `SaturdayDiscoverTests`, `WeekAheadTests`, `VerifiedWeeklyWrapTests`, `WeeklyWrapTests`, `PersonalisationTests`, `PersonalizationEngineTests`, `ProductVoiceTests` |
| News, search | `NewsFeedTests`, `NewsMarkdownTests`, `NewsStoryContentTests`, `HomeNewsContractTests`, `MarketInformationTests`, `GlobalSearchLogicTests`, `MarketDiscoveryTests`, `SecurityKindClassificationTests` |
| Simulator, maths, formatting | `InvestmentSimulationTests`, `AssetInvestmentSimulationTests`, `AuthenticatedSimulationSnapshotTests`, `SimulationDraftTests`, `BondYieldTests`, `LiquidityProfileTests`, `ChartComparisonMathTests`, `ChartScrubbingTests`, `AssetDetailsLogicTests`, `FinancialPresentationTests`, `AmountInputFormattingTests`, `LiveAmountEditingTests`, `CivilDatePresentationTests`, `LocalizationTests` |
| Platform plumbing | `AppErrorTests`, `ErrorRecoveryTests`, `AppUpdatePolicyTests`, `TelemetryPrivacyTests`, `PrivacyModeTests`, `ReviewPromptTests`, `LaunchSplashStateTests`, `PublicLogoImageDecoderTests`, `PublicLogoResourceCacheTests` |

`Tests/LocalizationSupport` is a tiny Objective-C target that lets tests select the bundle language.

### 14.2 JSON fixtures reusable as cross-platform contract tests

| File | Size | Encodes | Reuse |
|---|---|---|---|
| `Tests/MarketDiscoveryTests/PortfolioContractFixtures/portfolio-ledger.v1.json` | 6.6 KB | `{ version: 1, description, cases[] }`; each case: `name`, `instruments` (symbol -> kind), `transactions[]` (`id`, `security`, `kind`, `quantity`, `unit_price`, `fees`, `traded_on`, `created…` — decimals as strings) and expected results | Golden cases for the average-cost ledger; load verbatim in Kotlin/TypeScript tests |
| `Tests/MarketDiscoveryTests/HomeCompactFixtures/contract.json` | 7.0 KB | A complete `get_current_market_quotes` `home_v1` response (`quotes.prices[]` with `data_quality { status, reasons, validUntilEpoch, sourceObservedAtEpoch }`, sessions, overview, summary, calendar, securities) | Decoder + quote-policy contract test (also documents the quotes payload shape) |
| `Tests/MarketDiscoveryTests/VoiceFixtures/parity.v1.json` | 28.6 KB | Product-voice parity cases (inputs -> expected composition) shared with the server implementation | Mandatory if the second client composes copy locally |
| `Invest.AO/Core/ProductVoice/catalogue.v1.json` + `.sha256` | | The copy catalogue itself | Ship identically |
| `docs/intelligence-feature-config.example.json` | | Example `intelligence_feature_configuration.payload` | Decoder test |

### 14.3 UI tests (`UITests`, 12 files, about 1,800 LOC)

`LaunchSmokeTests`, `PrivacyModeUITests`, `AppearanceUITests` (referenced by CI; file not present under that name in `UITests/` — `UNVERIFIED`), `ComponentsUITests`, `SimulationUITests`, `WeeklyWrapUITests`, `HomeCompactUITests`, `HomeRefreshUITests`, `NavigationRefinementUITests`, `NotificationsUITests`, `PostLoginOnboardingUITests`, `ChartComparisonUITests`, `WidgetGallerySmokeTests`. They drive Debug-only mock hosts selected by launch arguments (9.4) backed by `Invest.AO/Mocks` (`MockMarketRepository`, `PreviewData`, network guards that block real requests in preview modes).

---

## 15. CI & release

| Item | Detail |
|---|---|
| `.github/workflows/verify.yml` ("iOS release verification") | On every PR and push to `main`, `macos-26`, 30 min: lint changed Swift files (`scripts/lint-changed-swift.py origin/main`), `swift test -c release --skip-update`, simulator UI tests on iPhone 17 Pro (PrivacyMode, Appearance, Components, Simulation, LaunchSmoke, one WeeklyWrap test) with code signing disabled, Release simulator build, Release device build (compile only — Release is wired to production, so no network-capable tests run against it), `git diff --check`, upload `.xcresult` |
| `.github/workflows/intelligence-evaluation.yml` | On PRs touching intelligence / personalisation / market / formatting / weekly-wrap data paths: Python unit test of the comparison script, `swift test --filter IntelligenceEvaluationTests` exporting `intelligence-evaluation.json`, artifact upload even on failure |
| Xcode Cloud | `Invest.AO.xcodeproj/xcshareddata/xcodecloud/manifest.json` registers target `Invest.AO`; no `ci_scripts` in the repo, workflows live in App Store Connect (`UNVERIFIED` configuration) |
| fastlane | Only `fastlane/metadata/pt-PT/` (name, subtitle, description, keywords, promotional text, release notes). **No Fastfile / lanes** |
| Release build | `scripts/export-app-store.sh BUILD_NUMBER OUTPUT_DIR`: clean Release archive, export with `Configuration/ExportOptions-AppStore.plist` (`app-store-connect`, automatic signing, team `FWNTLC5S45`, symbols uploaded), then `scripts/verify-app-store.py` checks the IPA (app + widget). Upload is manual (Transporter / Organizer). Release is a manual App Store release |
| Symbols | Archive build phase "Upload Debug Symbols to Sentry" (`scripts/upload-sentry-symbols.sh`, requires `SENTRY_AUTH_TOKEN`), fails the archive on upload failure |
| Versioning | `MARKETING_VERSION` semantic `major.minor.patch` (1.1.5), `CURRENT_PROJECT_VERSION` integer build (18), identical for app and widget; the force-update flag compares marketing versions only; intelligence configuration uses the integer build (`minimum_app_build`) |
| Lint/format | Airbnb Swift style via SwiftPM plugin (`scripts/format-swift.sh`, `scripts/lint-swift.sh`) |
| Release ordering constraint | Backend migrations are forward-only and must be deployed before a native release that depends on them (`Configuration/RELEASE.md`: ledger pagination RPC, notification evidence, `register-device` localisation capability) |
| Release notes | `docs/release-notes-1.1.3|1.1.4|1.1.5.en.txt`, `fastlane/metadata/pt-PT/release_notes.txt` |

---

## Appendix A. Top integration gotchas for a second client

1. **Market status is client-derived.** Compute open/closed from the server calendar contract in `Africa/Luanda`; never trust the `status` string or the device time zone. Without a valid, unexpired calendar (lifetime 121 s direct, up to 310 s bundled) nothing is "current".
2. **Quotes carry their own expiry.** Honour `data_quality.validUntilEpoch`, the 120-second source-observation ceiling while open, and the calendar transition deadline; downgrade locally on a timer, not only on refresh.
3. **Display precedence** quote -> BODIVA reference -> verified close -> last reported quote, each with a distinct label; only `verified_change_percent` may feed calculations.
4. **`market-snapshot` is a GET Edge Function** with HTTP caching and a `contract_version`; fall back to direct reads on contract/4xx failure, and for 5 minutes after a 5xx/timeout — never both in one refresh.
5. **Realtime is a hint only** (`market:prices` / `quotes`, private channel): jitter 0–10 s, then reload the snapshot; poll at 120 s as a watchdog; obey `control.min_poll_seconds` and `maintenance`.
6. **No automatic request retries**; SDK retry is disabled on paged reads. Back off the poll loop with full jitter and `retry_after_seconds`.
7. **Business limits arrive as PostgREST error messages** (`FREE_WATCHLIST_LIMIT`, `PLUS_REQUIRED`, `PRO_REQUIRED`, …) and features are unlocked for everyone unless `enforcement_enabled` is true.
8. **Decimals**: ledger, cash, thresholds are `numeric(24,8)` — never use binary floats; wrap evidence and frozen notification evidence send decimals as strings; market quotes are plain doubles.
9. **Civil dates** (`traded_on`, `trading_date`, `occurred_on`) are Luanda days; represent them as dates, not instants (iOS uses 12:00 Luanda to stay on the same day).
10. **Client-generated ids + upsert-ignore-duplicates** make ledger, cash and alert writes idempotent; keep that behaviour.
11. **Account-switch races**: re-check the session user after every await before applying or persisting a result; drop responses from an older generation.
12. **Push contract is APNs-shaped** (`apnsToken`, `bundleId`, `environment`) and the backend accepts only the production iOS bundle id; schema-2 payloads are validated against a strict key allow-list and generic copy rules; `user_id` must match the signed-in user.
13. **Subscriptions go through RevenueCat with app user id = Supabase user id**, then `sync-subscription`; the server snapshot, not the SDK, authorizes features.
14. **Analytics are installation-scoped and allow-listed**; never identify the user or send ids/amounts.
15. **Website obligations from the client**: `https://invest.ao/policy` and `https://invest.ao/partilha/<token>`; there are no universal links, no terms page, no article URLs and no web account-deletion page in the iOS client.
16. **Product-voice catalogue is shared with the server**; ship the same `catalogue.v1.json` and pass `parity.v1.json`, or render only server-provided compositions.
