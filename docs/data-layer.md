# Data layer

Every backend call the web makes, and where. The backend is a Supabase project; its code is in the `investao-functions` repository. This document describes the web's usage only. Differences from the backend are in [divergences.md](divergences.md).

## Clients

| Client | File | Role | Used for |
|---|---|---|---|
| Anonymous | `src/data/supabase/anonymous-client.ts` | `anon`, no session, no cookies | Public reads on the server; results may be cached |
| Server | `src/data/supabase/server-client.ts` | The visitor's session from cookies | Account reads and writes in server components, route handlers, server actions |
| Request | `src/data/auth/request-client.ts` | The session of one proxy or route-handler request; collects cookie writes to copy onto the response | Proxy refresh, `/auth/*`, deletion routes |
| Browser | `src/data/supabase/browser-client.ts` | Publishable key in the tab | Realtime, the market store's direct reads, the feature-control document, personalisation sync |

All share `CLIENT_OPTIONS` (`src/data/supabase/options.ts`): `db.retry` false, and `exactFetch` (one attempt, 20 s timeout, numbers with more digits than a double keeps are quoted before `JSON.parse`; `src/data/http/exact-fetch.ts`).

Paged table reads use `readAll` with pages of 500 rows, stopping at the first empty page (`src/data/supabase/read.ts`).

## Edge Functions

Called from the server only, with `fetch` to `<NEXT_PUBLIC_SUPABASE_URL>/functions/v1/<name>`.

| Function | Method | Auth sent | Body | Where |
|---|---|---|---|---|
| `market-snapshot` | GET | `apikey` (publishable key), `If-None-Match` | — | `src/app/api/market/snapshot/route.ts`, `src/data/market/snapshot-proxy.ts` |
| `web-checkout` | POST | `Authorization: Bearer <member token>`, `apikey` | `{product_id, method, phone?, nif?}` | `startWebCheckout` in `src/data/billing/web-passes.ts` |
| `web-order-status` | POST | Same | `{order_id}` | `readWebOrderStatus` in `src/data/billing/web-passes.ts` |
| `apple-web-deletion/start` | POST | Same | `{returnPlatform: "web", browserChallenge}` | `startAppleDeletion` in `src/data/account/deletion.ts` |

The member Edge Function calls use `redirect: "error"`, `cache: "no-store"` and a timeout (20 s for billing, 15 s for deletion).

## RPCs

| RPC | Arguments sent | Role | Where |
|---|---|---|---|
| `get_current_market_quotes` | — | browser client | Direct-read fallback of the market store, `src/data/market/repository.ts` |
| `get_market_calendar` | `starts_on`, `ends_on` | browser client; member | `src/data/market/repository.ts`; `src/features/week-ahead/server.ts` |
| `get_available_market_wraps` | — | anon, cached 300 s | `src/data/account/wraps.ts` |
| `get_unusual_activity` | — | anon | `src/data/market/unusual-activity.ts` |
| `get_shared_portfolio` | `share_token` | anon, raw `fetch` to `/rest/v1/rpc/get_shared_portfolio`, `no-store` | `src/data/portfolio/shared-portfolio.ts` |
| `get_web_plans` | — | anon (public `/plus`, cached 300 s) and member (`/planos`) | `src/data/billing/web-passes.ts`, `src/data/billing/public-plans.ts` |
| `get_web_orders` | — | member | `src/data/billing/web-passes.ts` |
| `cancel_web_order` | `order_id` | member | `src/data/billing/web-passes.ts` |
| `get_subscription_access` | — | member | `src/data/account/reads.ts` |
| `authorize_chart_comparison` | `security_ids` | member | `src/data/account/reads.ts`, called from `src/features/account/actions.ts` |
| `select_free_watchlist` | `security_ids`, `movement_id` | member | `src/data/account/watchlist.ts` |
| `reorder_watchlist` | `security_ids` | member | `src/data/account/watchlist.ts` |
| `get_intraday_chart` | `requested_security_id` | member | `src/data/account/reads.ts` |
| `get_portfolio_ledger_page` | Cursor arguments, pages of 500 | member | `src/data/account/portfolio.ts` |
| `create_portfolio_share` | `share_portfolio_id`, `share_label` | member | `src/data/account/portfolio.ts` |
| `get_account_notifications` | Page size and keyset cursor | member | `src/data/account/activity.ts` |
| `acknowledge_account_notifications` | `notification_ids`, `opened` | member | `src/data/account/activity.ts` |
| `set_market_recap_preference` | `wants_recaps` | member | `src/data/account/activity.ts` |
| `get_market_period_evidence` | `starts_on`, `ends_on`, `requested_kind` | member | `src/data/intelligence/evidence-server.ts`, `src/data/intelligence/evidence.ts` |
| `delete_user_account` | — | member | `src/data/account/deletion.ts` |

## Tables and views

### Public reads (anon on the server unless noted)

| Object | Read | Where |
|---|---|---|
| `securities` | `id, symbol, isin, name, currency, security_type, issuer_id, is_active`, all rows | `src/data/market/public.ts`; also the browser's direct-read fallback in `src/data/market/repository.ts` |
| `latest_verified_market_closes` | All rows | Same two files |
| `price_history` | One instrument's daily rows up to a date | `src/data/market/history.ts` (anon for the public year, member for `/api/account/history/[id]`) |
| `quality_market_pulse_history` | The market index | `src/data/market/history.ts`, `src/data/market/repository.ts` |
| `issuers` | One active issuer; logo sources of up to 1000 active issuers | `src/data/market/public.ts` |
| `latest_issuer_dividends` | Latest dividend of one issuer | `src/data/market/public.ts` |
| `issuer_dividends` | Dividends by payment date (income calendar, limit 500); all rows with issuer name (week ahead, member) | `src/data/market/public.ts`, `src/features/week-ahead/server.ts` |
| `issuer_financial_reports` | One issuer's reports | `src/data/market/public.ts` |
| `market_rates` | Latest values of the benchmark rates | `src/data/market/public.ts` |
| `news_articles` | Published feed, title search, one article by slug; `id, slug` of published ids for activity rows | `src/data/market/public.ts`, `src/data/account/activity.ts` |
| `market_events` | `kind = new_listing`, not cancelled, not expired, by priority, limit 20; cached 300 s | `src/data/market/listing.ts` |
| `intelligence_feature_configuration` | `payload` where `id = true`, from the browser | `src/data/intelligence/feature-config.ts` |

### Member reads and writes (server client)

| Table | Operations | Where |
|---|---|---|
| `watchlist_items` | select; insert (with the next `sort_order`); delete (returning the row for undo); update `automatic_alerts_enabled` | `src/data/account/watchlist.ts` |
| `watchlist_groups` | select; upsert on `id` ignoring duplicates; update `name`; delete | `src/data/account/groups.ts` |
| `watchlist_group_items` | select; upsert on `group_id,security_id` ignoring duplicates; delete | `src/data/account/groups.ts` |
| `notification_rules` | select; upsert (create); update `kind`, `threshold`, `is_enabled`; delete | `src/data/account/rules.ts` |
| `user_movement_preferences` | select `sensitivity`; upsert on `user_id` | `src/data/account/rules.ts` |
| `notification_deliveries` | select (alert rows of the activity window); update `is_read` | `src/data/account/activity.ts` |
| `notification_preferences` | select `*`; upsert on `user_id` | `src/data/account/activity.ts` |
| `user_recap_preferences` | select `enabled` | `src/data/account/activity.ts` |
| `unusual_activity_preferences` | select `notifications_enabled, disabled_rules`; upsert on `user_id` | `src/data/account/activity.ts` |
| `portfolio_transactions` | upsert (create with the client's id); update; delete. Reads go through `get_portfolio_ledger_page` | `src/data/account/portfolio.ts` |
| `portfolios` | select `id, name`; upsert on `id` ignoring duplicates; update `name`; delete | `src/data/account/portfolio.ts` |
| `portfolio_cash_movements` | select; upsert; delete | `src/data/account/portfolio.ts` |
| `portfolio_shares` | select `id, label, created_at`; delete | `src/data/account/portfolio.ts` |
| `quality_latest_order_books` | select one instrument's latest book | `src/data/account/reads.ts` |
| `user_profiles` | select `display_name` | `src/data/account/profile.ts` |

### From the browser client

| Table | Operations | Where |
|---|---|---|
| `user_activity_daily` | upsert daily counters; select since a day | `src/data/personalisation/repository.ts`, called from `src/data/personalisation/personalisation.ts` |

## Auth API

| Call | Where |
|---|---|
| `signInWithOAuth` (Google, Apple; PKCE) | `src/app/auth/sign-in/route.ts` |
| `exchangeCodeForSession` | `src/app/auth/callback/route.ts` |
| `signInWithPassword` (`local` builds only) | `src/app/auth/local-password/route.local.ts` |
| `getSession` (refresh) | `src/proxy.ts`; also to read the member token for Edge Function calls |
| `getClaims` (verification) | `src/data/auth/account.ts`, `src/data/account/session.ts`, `src/features/account-setup/actions.ts` |
| `getUser` | `src/data/account/profile.ts`, `src/data/account/deletion.ts`, `src/app/api/account/apple-deletion/complete/route.ts` |
| `updateUser` (metadata `investao_onboarding_completed`, display name), `refreshSession` | `src/data/auth/account.ts`, `src/features/account-setup/actions.ts` |
| `signOut` (all sessions; `scope: "local"` after deletion) | `src/app/auth/sign-out/route.ts`, `src/app/api/account/delete/route.ts` |

User metadata keys read: `investao_display_name`, `investao_name_skipped`, `investao_onboarding_completed`, `full_name`, `name` (`src/domain/auth/account.ts`).

## Realtime

One channel: topic `market:prices`, private, broadcast event `quotes` (`src/data/market/realtime.ts`). Only `generated_at` and `etag` are read from the payload; prices in it are ignored. A message triggers a snapshot reload outside maintenance and backoff (`acceptsAnnouncement` in `src/domain/market/refresh.ts`). After `CHANNEL_ERROR`, `TIMED_OUT` or `CLOSED`, the channel is rejoined after 30 seconds. The channel is left while the tab is hidden (`src/features/market/market-provider.tsx`).

## The market snapshot

The browser reads `/api/market/snapshot` with `cache: "no-cache"` so it revalidates with `If-None-Match` (`src/data/market/route-source.ts`). The body is decoded by `decodeSnapshotBundle` (`src/domain/market/decode.ts`) and accepted by `acceptSnapshotBundle` (`src/domain/market/snapshot.ts`). The bundle's `pulse`, `calendar` and `control` replace their own reads until `fresh_until` (`src/data/market/extras.ts`).

After a snapshot server failure, direct reads (`securities`, `get_current_market_quotes`, `latest_verified_market_closes`) replace the snapshot for five minutes (`src/data/market/repository.ts`). In demo mode only the snapshot is read.

## Server rule errors

PostgREST errors with code `P0001` and a known message are mapped to typed rules (`src/domain/errors/rules.ts`):

`FREE_WATCHLIST_LIMIT`, `FREE_MOVEMENT_LIMIT`, `PLUS_REQUIRED`, `PRO_REQUIRED`, `WATCHLIST_GROUP_LIMIT`, `PORTFOLIO_LIMIT`, `SHARE_LIMIT`, `PORTFOLIO_NOT_FOUND`, `FREE_COMPARISON_SIZE_LIMIT`, `FREE_COMPARISON_WEEK_LIMIT`, `COMPARISON_DATA_UNAVAILABLE`, `REFERRALS_UNAVAILABLE`, `REFERRAL_CODE_INVALID`, `REFERRAL_OWN_CODE`, `REFERRAL_ALREADY_USED`, `REFERRAL_NOT_ELIGIBLE`.

`details.feature` of `PLUS_REQUIRED` selects the upgrade reason for `watchlist_groups`, `alert_rules`, `portfolios`, `cash` and `clientViews`; any other feature maps to the reason `onboarding`.

Edge Function error codes of the billing functions are mapped in `FAILURE_CODES` (`src/domain/billing/web-pass.ts`); see [plus-and-web-passes.md](plus-and-web-passes.md).

## Other services

| Service | Call | Where |
|---|---|---|
| PostHog | `POST https://us.i.posthog.com/flags?v=2` from the server (maintenance flag) | `src/data/flags/maintenance.ts` |
| PostHog | `POST https://us.i.posthog.com/i/v0/e/` from the browser (events) | `src/data/telemetry/telemetry.ts` |
| Sentry | Crash reports to the DSN's ingestion host | `src/data/telemetry/sentry.ts` |
| Issuer websites and logo URLs | Server-side image fetch | `src/app/api/logos/[issuer]/route.ts` |
| Apple | Browser redirect to `https://appleid.apple.com` during account deletion | `src/data/account/deletion.ts` |

## Demo mode

Each read has a demo branch that returns data built from `tests/fixtures/market/market-snapshot.production.json` and from cookies (`src/data/market/demo`, `src/data/demo`). No request leaves the server in demo mode except the Open Graph and logo routes' own logic (`getIssuerLogoSource` returns nothing in demo mode, `src/data/market/public-cache.ts`).
