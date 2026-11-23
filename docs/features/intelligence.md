# Intelligence and personalisation

"Intelligence" is the code's name for the weekly reading: short verified observations about the watchlist, the portfolio and the market, computed in the browser for the signed-in account. The domain code is a port of the iOS modules named in each file's header comment.

## Flow

1. The browser asks `/api/account/intelligence?starts_on=&ends_on=` for one week (a Luanda Monday to its Friday, or any day up to Sunday; `requestedWeek` in `src/features/intelligence/server.ts`).
2. The route returns three parts, each failing on its own: the raw `get_market_period_evidence` answer, up to 20 recent publications, and the ledger.
3. `IntelligenceCoordinator` (`src/features/intelligence/coordinator.ts`) validates the evidence (`decodeMarketPeriodEvidence`, `src/data/intelligence/evidence.ts`) and runs the engine (`src/domain/intelligence/engine.ts`).
4. One evaluation per tab is shared by the watchlist card, the portfolio tiles, the Home context slot and the activity rows.

Rules in the coordinator:

- Evidence older than 15 minutes is fetched again (`MAXIMUM_FETCH_AGE`).
- Every await is followed by a check that the same request and account are still current.
- A saved reading replays only while the market is closed.
- After a failure the provider retries after 5 minutes (`RETRY_MS` in `src/features/intelligence/intelligence-provider.tsx`).

## Surfaces

| Surface | Component | Limit |
|---|---|---|
| Watchlist "Leitura da semana" | `WatchlistInsights` (`src/features/intelligence/watchlist-insights.tsx`) | Two observations |
| Portfolio dashboard sections | `PortfolioInsights` (`portfolio-insights.tsx`) | Two tiles per section; none in privacy mode |
| Home context slot | `HomeContextSlot` (`home-context-slot.tsx`), priority rules in `src/domain/intelligence/home-context.ts` | One card |
| Activity | `useLocalActivity` (`activity-rows.ts`) | Merged with the server's rows |

A detail sheet shows what was measured, from which closes, and when.

Saturday Discover offers at most 5 insights on a verified closed Saturday in Luanda (`src/domain/personalisation/saturday-discover.ts`).

## Feature controls

`src/domain/intelligence/feature-controls.ts`, `src/data/intelligence/feature-config.ts`.

- The document is `intelligence_feature_configuration.payload`, read from the browser.
- Feature keys: `insight_engine`, `snapshot_capture`, `market_events`, `weekly_wrap`, `saturday_discover`, `week_ahead`, `personalized_home`, `activity_center`, `intelligence_notifications`, `personalization_engine`, `personalization_v2`, `price_changes`, `watchlist_breadth`, `portfolio_performance`, `portfolio_allocation`, `watchlist_patterns`, `publications`, `notification_watchlist`, `notification_movement`, `notification_market_recap`.
- Some features depend on others, for example `weekly_wrap` on `insight_engine` and `snapshot_capture`, `week_ahead` on `market_events` (`DEPENDENCIES`).
- The decoder rejects unknown fields and omissions. A missing, invalid or expired document turns optional features off and keeps known kill switches. The last valid document is kept in `localStorage`.
- Rollout bucketing is FNV-1a 32-bit over `identity|feature|salt`, modulo 10000. The identity stays in the browser.
- Audience: `production` when the data mode is `production` and `NEXT_PUBLIC_VERCEL_ENV` is unset or `production`; otherwise `internal` (`intelligenceAudience`).
- `minimum_app_build` never excludes the web (`WEB_APP_BUILD`).
- The document is refreshed in the background at most once a minute.
- Demo mode serves a document with every feature on except `intelligence_notifications` and `personalization_v2`.

## Cache

`src/data/intelligence/cache-store.ts`, `src/domain/intelligence/cache.ts`:

- IndexedDB, one database per browser, keys `<user id>:<kind>`; kinds `portfolio`, `watchlist`, `weekAhead`.
- Maximum age: 7 days for readings, 1 day for the week ahead. Maximum size 2 MB.
- The local activity archive keeps 56 days (`LOCAL_ACTIVITY_RETENTION`, `src/domain/intelligence/activity.ts`).
- Storage failures leave the app working from memory. Sign-out deletes the database.

## Personalisation

`src/domain/personalisation`, `src/data/personalisation`:

- Deliberate discovery actions (viewing an instrument, selecting a search result, comparing, choosing a chart range, adding to or removing from the watchlist) are counted per day. Raw events are not kept.
- Daily counters are kept 112 days; exposure receipts and feedback 56 days.
- The counters are synchronised with `user_activity_daily` from the browser ([divergences.md](../divergences.md), B1).
- Privacy mode stops capture, receipts and feedback.
- Nothing from personalisation is sent to analytics.
- Settings offers two resets, both local to the browser.

## Product voice

`src/domain/product-voice`: sentences are composed deterministically from a reviewed catalogue, `catalogue.v1.json`. The catalogue is a byte-identical copy of `tests/fixtures/catalogue.v1.json`, checked against `catalogue.v1.sha256` in `product-voice.test.ts`. Only schema 1 in `pt-AO` is accepted.

## Evaluation suite

`src/domain/intelligence/evaluation`:

- `harness.ts` runs the production pipelines over the scenarios in `scenarios.ts` and reports findings of severity `hard` or `quality`.
- `evaluation.test.ts` fails on any failed hard finding, on incomplete decision evidence, and on a duplicate item in a surface. It also asserts the export is identical across runs and input orders.
- With `INTELLIGENCE_EVALUATION_OUTPUT` set, the suite writes its export before asserting. `npm run intelligence:evaluate` sets it to `docs/evidence/w14/web-intelligence-evaluation.json`.
- `docs/evidence/w14/ios-intelligence-evaluation.json` is an export of the iOS suite. No code in this repository reads either file; the comparison script named in `harness.ts` is not in this repository.

## Tests

`tests/e2e/intelligence.spec.ts` (three of its tests are tagged `@engines` and also run in Firefox and WebKit); unit tests in `src/domain/intelligence`, `src/domain/personalisation`, `src/domain/product-voice`, `src/data/intelligence`.
