# invest.ao backend — client integration contract

Source: static read of the backend snapshot `src/backend` (`origin/main`), 160 migrations, 17 Edge Functions. Paths below are relative to that snapshot. Nothing was executed; final state was derived by replaying migration statements in order (last `create or replace`, renames, drops, grants/revokes, and the `do $$` blocks that patch function bodies by text replacement).

Conventions: `anon` = signed-out publishable key; `auth` = `authenticated` role (user JWT); `svc` = `service_role` (never in a client). `UNVERIFIED` = could not be confirmed from the snapshot.

Method caveats (apply everywhere):
- Grants were simulated assuming standard Supabase defaults (ALL on `public` tables and EXECUTE on functions to `anon`/`authenticated`/`service_role`) for objects created before `20260913124915_restrict_client_database_grants.sql`, which revokes those defaults for later objects. Hosted default privileges are UNVERIFIED.
- Hosted dashboard settings (auth providers, redirect allow-list, JWT expiry, role timeouts, Realtime settings, deployed function versions) are not in the repo.

---

## 0. Surface map

| Channel | Base path | Used for |
|---|---|---|
| PostgREST | `/rest/v1/<table or view>`, `/rest/v1/rpc/<fn>` | All tables/views/RPCs in schema `public` (`supabase/config.toml` `[api] schemas = ["public","graphql_public"]`, `max_rows = 1000`) |
| Edge Functions | `/functions/v1/<name>` | `market-snapshot`, `register-device`, `unregister-device`, `sync-subscription`, `delete-apple-account`, `apple-web-deletion/{start,callback}`, `health` |
| Auth (GoTrue) | `/auth/v1/*` | Sign-in, session refresh, MFA |
| Realtime | `/realtime/v1` | Broadcast topic `market:prices` |
| Storage | `/storage/v1` | Not client-facing. Bucket `bodiva-raw` is private, service-only |

Private schemas (never reachable through PostgREST): `access_private`, `calendar_private`, `data_quality_private`, `editorial_private`, `intelligence_private`, `market_cache_private`, `notification_private`, `observability_private`, `portfolio_private`, `publication_bridge_private`, `recap_private`, `subscription_private`, `unusual_activity_private`, `watchlist_private`, `wrap_private`.

---

## 1. Auth

### 1.1 Configuration (`supabase/config.toml`, local stack)

| Setting | Value | Note |
|---|---|---|
| `site_url` | `http://127.0.0.1:3000` | Local only |
| `additional_redirect_urls` | `investao://auth/callback`, `investao-dev://auth/callback` | No `https://` web origin and no Android-specific scheme is listed. Hosted allow-list UNVERIFIED |
| `enable_signup` | `true` | But see hook below |
| `[auth.mfa.totp]` | `enroll_enabled = true`, `verify_enabled = true` | Used by the editorial portal (aal2 gate) |
| `[auth.hook.before_user_created]` | enabled, `pg-functions://postgres/public/hook_before_user_created` | Must also be enabled in the hosted dashboard (`docs/subscriptions.md`) |
| `[auth.external.*]` | absent | Apple/Google provider config lives only in the hosted dashboard. UNVERIFIED |
| JWT expiry | not set | CLI default (3600 s). Hosted value UNVERIFIED |
| Anonymous sign-ins | not set | CLI default off. Edge deletion handlers reject `user.is_anonymous` |

### 1.2 Sign-up rule (email sign-up blocked)

`public.hook_before_user_created(event jsonb)` (`20261112250000_paid_limits.sql`), executable only by `supabase_auth_admin`:

- `event.user.app_metadata.provider = 'email'` -> `{"error":{"http_code":403,"message":"Sign-ups are closed."}}`
- anything else -> `{}`

Consequences: only OAuth/ID-token providers create accounts ("Apple and Google sign-up continue", `docs/subscriptions.md`). Email invitations are refused; an admin can still create a user with `auth.admin.createUser`. Existing email users can still sign in (the hook only runs on creation).

### 1.3 Claims the backend reads

| Claim | Where | Effect |
|---|---|---|
| `sub` (`auth.uid()`) | every owner RLS policy and RPC | Ownership. No RPC accepts a user id from the client |
| `role` | `approve_assistant_prepared_article` | Must be `authenticated` |
| `aal` | `editorial_private.role()` (`20261112210000`) | Editorial role resolves only at `aal2` when `editorial_private.control.require_aal2` is true (default false) |
| `app_metadata.admin === true` or `app_metadata.role === "admin"` | `_shared/auth.ts` `requireAdmin` | Only `admin-refresh-market` |
| `is_anonymous` | deletion handlers | Rejected with 401 |

There is no tier claim in the JWT. Entitlement is always read with `get_subscription_access()` (section 7). `user_profiles.is_admin` exists but nothing reads it.

### 1.4 Role statement timeouts

Not set in any migration. `docs/verified-close-timeout-51.md` records production role settings on 9 Oct 2026: **3 s `anon`, 8 s `authenticated`, 8 s `authenticator`**. Current values UNVERIFIED. A timeout surfaces as HTTP 500 with `Proxy-Status: PostgREST; error=57014` (same doc).

### 1.5 Account deletion

Three paths. Rows in user tables cascade from `auth.users` (`on delete cascade`).

| Path | Who | Call |
|---|---|---|
| A. Non-Apple account | any client | `POST /rest/v1/rpc/delete_user_account` (no args, `auth` only) |
| B. Apple account, native code | iOS | `POST /functions/v1/delete-apple-account` |
| C. Apple account, browser redirect | Android, website, iOS fallback | `POST /functions/v1/apple-web-deletion/start` then Apple `form_post` to `/callback` |

**A. `delete_user_account()`** (`20261001004955`): returns void. Errors: `28000` "Not authenticated"; `42501` "Apple authorization must be revoked before account deletion" when the user has an `apple` identity. A Google-only account deletes here with no provider revocation.

**B. `delete-apple-account`** (`_shared/apple_account_deletion.ts`; gateway `verify_jwt = false`, handler verifies the bearer)

Request: `POST`, `Authorization: Bearer <user JWT>`, JSON:

| Field | Type | Rule |
|---|---|---|
| `expectedUserID` | string | case-insensitive equal to the JWT user id |
| `authorizationCode` | string | fresh Apple authorization code, 1..4096 chars |

Response 200: `{"deleted": true}`.

| Status | `error.code` | When |
|---|---|---|
| 405 | `METHOD_NOT_ALLOWED` | not POST |
| 401 | `UNAUTHENTICATED` | missing/invalid bearer or anonymous user |
| 400 | `INVALID_JSON` / `INVALID_DELETION` | body shape |
| 403 | `APPLE_IDENTITY_REQUIRED` | no linked Apple identity |
| 503 | `APPLE_REVOCATION_UNAVAILABLE` | `APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET` missing |
| 400 | `APPLE_AUTHORIZATION_FAILED` | Apple code exchange refused |
| 502 | `APPLE_INVALID_RESPONSE` | id_token unreadable |
| 403 | `APPLE_IDENTITY_MISMATCH` | `sub`/`aud`/`iss`/`exp`/refresh token check failed |
| 502 | `APPLE_REVOCATION_FAILED` | revoke failed, account kept |

The code is exchanged with `client_id = APPLE_CLIENT_ID` (the native bundle id), so a code obtained with a Services ID (Android/web) does not work here. Use path C.

**C. `apple-web-deletion`** (`_shared/apple_web_deletion.ts`; state table `public.apple_web_deletion_states`, service-only)

`POST /functions/v1/apple-web-deletion/start`, `Authorization: Bearer <user JWT>`. Body optional (max 1024 chars):

| Field | Values | Rule |
|---|---|---|
| `returnPlatform` | `"native"` (default) or `"web"` | |
| `browserChallenge` | 64 lowercase hex | required when `web` |

Response 200:

```json
{ "authorizationURL": "https://appleid.apple.com/auth/authorize?...", "expiresAt": "<ISO, now+5 min>", "returnPlatform": "native|web", "receiptVersion": 1, "userID": "<uuid>" }
```
`receiptVersion` and `userID` only for `web`.

Errors: 405 `METHOD_NOT_ALLOWED`, 503 `APPLE_WEB_UNAVAILABLE` (server config), 401 `UNAUTHENTICATED`, 403 `APPLE_IDENTITY_REQUIRED`, 400 `INVALID_RETURN_PLATFORM`, 503 `APPLE_WEBSITE_UNAVAILABLE` (web return URL or receipt secret missing), 404 `NOT_FOUND` (other path).

State machine:

| Step | Actor | Effect |
|---|---|---|
| 1 | client -> `/start` | Server stores `sha256(state)`, nonce, user id, Apple `sub`, platform, challenge; TTL 5 min; expired rows purged |
| 2 | client | Opens `authorizationURL` in the system browser (`response_type=code id_token`, `response_mode=form_post`, `scope=name email`) |
| 3 | Apple -> `/callback` | `application/x-www-form-urlencoded`. `DELETE ... RETURNING` claims the state once. Replay or expiry -> 400 `INVALID_STATE` |
| 4 | server | Checks linked Apple `sub` unchanged, exchanges code with `APPLE_WEB_CLIENT_ID`, checks nonce, revokes refresh token, deletes the user |
| 5 | server -> browser | `303` redirect |

Step 5 redirect target:

| Platform | Location | Query |
|---|---|---|
| `native` | `APPLE_WEB_RETURN_URL` (scheme must be `https`, `investao`, or `investao-dev`) | `?status=deleted|cancelled|failed` |
| `web` | `APPLE_WEBSITE_RETURN_URL` (docs: `https://invest.ao/api/account/apple-deletion/complete`) | `?receipt=<token>` |

Receipt (`_shared/apple_deletion_receipt.ts`): `base64url(JSON) + "." + base64url(HMAC-SHA256(key, "investao.apple-deletion.v1." + data))`, key = 32 bytes from hex `APPLE_WEBSITE_RECEIPT_SECRET`. Payload `{version:1, audience:"investao-web-account-deletion", userID, challenge, outcome:"deleted|cancelled|failed", issuedAt, expiresAt}` with `expiresAt - issuedAt = 300`. The website server must verify signature, audience, expiry, and that `challenge` and `userID` match its own HttpOnly attempt cookie (`docs/apple-account-deletion.md`).

Client rules: clear the local session only on `deleted`, and confirm with the server. Any failure consumes the state; start again. There is one native return URL per deployment, so Android must either share the `investao://` scheme or use the `web` platform through its own server component.

---

## 2. Database surface — conventions

- Money and prices are Postgres `numeric`. PostgREST emits them as JSON numbers. Parse as decimal, never as float.
- `date` columns are Luanda trading days (`YYYY-MM-DD`). `timestamptz` are UTC instants.
- PostgREST page cap: 1000 rows (`config.toml`). Paginate with `Range`/`limit`+`offset` and a stable `order`.
- Error body from PostgREST: `{"code","message","details","hint"}`. Business errors use `code = "P0001"` with the reason in `message` and JSON in `details`.

| SQLSTATE | Meaning here | HTTP (PostgREST mapping, UNVERIFIED per version) |
|---|---|---|
| `P0001` | Named business rule (`FREE_WATCHLIST_LIMIT`, `PLUS_REQUIRED`, ...) | 400 |
| `PT409` | Optimistic concurrency failure | 409 |
| `28000` / `42501` | Not authenticated / not allowed | 401 or 403 |
| `22023` | Invalid argument | 400 |
| `23514` | Check violation or trigger rule | 400 |
| `23505` | Unique violation | 409 |
| `22007` | Future trade date | 400 |
| `57014` | Statement timeout | 500 |

Enums (final values):

| Type | Values |
|---|---|
| `notification_rule_kind` | `price_above`, `price_below`, `percent_change_above`, `percent_change_below`, `high_52w`, `low_52w`, `volume_above_average`, `days_without_trades` |
| `notification_delivery_kind` | `alert_rule`, `watchlist_price_change`, `automatic_movement`, `intraday_movement`, `market_recap`, `market_listing`, `portfolio_daily`, `news_publication`, `weekly_wrap`, `unusual_activity`, `daily_close` |
| `notification_delivery_status` | `pending`, `processing`, `delivered`, `failed`, `invalid_token`, `suppressed` |
| `portfolio_transaction_kind` | `buy`, `sell`, `income` |
| `portfolio_cash_kind` | `deposit`, `withdrawal`, `fee` |
| `order_side` | `bid`, `ask` |

---

## 3. Public market data (anon + auth unless noted)

### 3.1 Recommended read path

`GET /functions/v1/market-snapshot` (section 9.1) returns catalogue, quotes, closes, pulse, calendar and client control in one cached document. The direct reads below are the fallback and the detail reads.

### 3.2 Catalogue

**`securities`** (table, SELECT, RLS `true`)

| Column | Type | Note |
|---|---|---|
| `id` | uuid | Primary id used everywhere |
| `symbol` | text unique | BODIVA trading code |
| `isin` | text unique null | |
| `name` | text null | |
| `security_type` | text | Normalised by trigger: `stock`, `fund`, `bond`, `treasury_bond`, `other` (code also tolerates legacy `equity`) |
| `currency` | text | `^[A-Z]{3}$`, default `AOA` |
| `is_active` | boolean | Forced false when symbol fails `^(OT-[A-Z0-9-]+|[A-Z0-9]{3,12})$` |
| `issuer_id` | uuid null | |
| `catalog_status` | text null | `active`/`inactive` |
| `maturity_date` | date null | |
| `catalog_collected_at`, `catalog_source_url`, `catalog_source_sha256`, `catalog_parser_version` | provenance | |
| `created_at`, `updated_at` | timestamptz | |

Symbol classification (`bodiva_security_type`, `20260901174222`): `OT-*` or `^[BO][A-Z][0-9]{2}[A-Z0-9]{4}$` -> `treasury_bond`; `^[A-Z0-9]{4}DOF[A-Z0-9]$` -> `bond`; `^[A-Z0-9]{4}UFV[A-Z0-9]$` -> `fund`; `^([A-Z]{3}A{5}|[A-Z]{4}A{4})$` -> `stock`.

**`active_market_securities`** (view): `securities` rows that are registered active, not `catalog_status='inactive'`, and not past maturity (maturity also decoded from the symbol pattern `XXddMyyX`). Use this for "tradable now" lists; use `securities` for deep links and history.

**`issuers`** (table): `id`, `external_id`, `name`, `short_name`, `website_url`, `logo_url`, `sector`, `headquarters`, `description`, `is_active`, `created_at`, `updated_at`.

**`issuer_financial_reports`**: `id`, `issuer_id`, `title`, `reporting_period`, `report_type` (`annual|interim|other`), `period_end`, `published_at` (date), `url` (https), `source_name`.

**`issuer_dividends`** and view **`latest_issuer_dividends`** (latest fiscal year per issuer): `id`, `issuer_id`, `fiscal_year`, `amount_per_share` numeric(24,8), `currency`, `is_gross`, `record_date`, `ex_dividend_date`, `payment_date`, `frequency`, `source_url`.

### 3.3 Quotes

**RPC `get_current_market_quotes()`** -> jsonb (anon, auth). Final body `20261112230000_market_cache_reads_serve.sql`.

Default call (no header): returns the cached snapshot's `quotes` part while fresh, otherwise computes live. Shape (`data_quality_private.live_market_quotes`, `20261112220000`):

| Key | Content |
|---|---|
| `prices[]` | One row per security with a market price: `id`, `security_id`, `symbol`, `name`, `currency`, `trading_date`, `open_price`, `close_price`, `previous_close_price`, `high_price`, `low_price`, `last_price`, `change_percent`, `volume`, `traded_value`, `trade_count`, `data_quality`, `verified_change_percent` |
| `sessions[]` | Latest `quality_market_sessions` row (0 or 1) |
| `overview[]` | 0 or 1 object: `market_session_id`, `trading_date`, `status`, `last_updated_at`, `last_successful_ingestion_at`, `source` (`"BODIVA"`), `timezone` (`"Africa/Luanda"`), `instrument_count`, `advancing`, `declining`, `unchanged`, `unavailable_movements`, `data_status`, `source_trading_date`, `collected_at`, `published_at` |
| `availability` | `status` (`unknown|partial|available|sourceUnavailable|delayed`), `lastSuccessfulObservationAtEpoch`, `lastAttemptAtEpoch`, `retryAfterEpoch`, `availableInstrumentCount`, `totalInstrumentCount`, `sourceTradingDate`, `session_quote_count`, `reference_price_count`, `missing_price_count`, `active_instrument_count`, `coverage_date` |
| `reference_prices[]` | Per active security: `security_id`, `reference_price` (`price`, `price_date`, `traded_at`, `collected_at`, `source_url`, `source_hash`, `parser_version`) or null, `reference_last_checked_at`, `reference_update_status`, `reference_unavailable_reason` (`emptyHistory|invalidSource|sourceUnavailable|rateLimited|missingProvenance|notYetCollected`), `reference_update_reason` |
| `active_security_ids[]` | uuids of the active universe |

Home projection: send request header `x-investao-projection: home_v1`.

| Market status | Response |
|---|---|
| not `open` | `{"contract_version":1,"requires_full_snapshot":true}` -> call again without the header |
| `open` | `contract_version`, `requires_full_snapshot:false`, `generated_at`, `summary` (`instrument_count`, `available_quote_count`, `valid_until_epoch`, `last_observation_epoch`, coverage counts, `coverage_date`), `calendar` (49-day `get_market_calendar` document), `securities[]` (up to 9: top 3 gainers, 3 decliners, 3 by volume), `quotes{prices,sessions,overview,availability,reference_prices}` limited to those securities |

**`data_quality` object** (on prices, sessions, order books, pulse):

| Key | Values |
|---|---|
| `status` | `valid`, `incomplete`, `invalid`, `unknown`, `stale`, `delayed` |
| `reasons[]` | empty when valid; else one of `missingObservation`, `invalidValue`, `invalidTimestamp`, `missingProvenance`, `delayedIngestion`, `unavailableCalendar`, `staleObservation`, `notFinal` |
| `sourceObservedAtEpoch` | seconds, null when unknown |
| `validUntilEpoch` | seconds. The client must stop showing the value as current after this instant |

A quote is usable as "current" only when `status = "valid"`, `reasons = []`, `trading_date` = today in Luanda, and now < `validUntilEpoch`. During an open session `validUntilEpoch` is at most source observation + 120 s (`docs/market-freshness-phase1.md`).

`change_percent` is the BODIVA-reported value. `verified_change_percent` is recomputed against the previous trading day's verified close and is null when that evidence is missing.

**Views** (same data, row form):

| View | Columns |
|---|---|
| `latest_market_prices` | `id`, `security_id`, `symbol`, `name`, `currency`, `trading_date`, `open_price`, `close_price`, `previous_close_price`, `high_price`, `low_price`, `last_price`, `change_percent`, `volume`, `traded_value`, `trade_count` |
| `quality_market_prices` | above + `data_quality`, `verified_change_percent` |
| `quality_market_sessions` | `market_sessions.*` + `data_quality` |
| `market_overview` | same keys as `overview[]` above |
| `latest_verified_market_closes` | `security_id`, `price` numeric(24,8), `trading_date`, `confirmed_at`, `verified_change_percent` |

Base tables also readable: `market_sessions` (`id`, `trading_date`, `total_volume`, `total_value`, `trade_count`, `status`, `published_at`, `opened_at`, `closed_at`, `source_trading_date`, `collected_at`, `source_run_id`), `market_prices` (per session/security, includes generated `absolute_change`), `market_rates` (`trading_date`, `rate_name`, `tenor`, `value`, `unit`), `average_prices` (`trading_date`, `security_id`, `average_price`).

`data_status` (`bodiva_source_data_status`): `unknown`, `stale`, `delayed`. Never `live` (`SOURCE_FRESHNESS.md`).

### 3.4 Daily history

**`price_history`** (table): `id`, `security_id`, `trading_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `traded_value`, `source_run_id`. Unique `(security_id, trading_date)`.

RLS (`20261112250000`): `trading_date >= access_private.history_starts_on()`. When enforcement applies and the caller has no Plus (signed-out included), only the last year (Luanda date) is returned. No error is raised; older rows are just absent.

`quality_price_history` exists but is revoked from clients (`20261112190000`).

### 3.5 Market index ("pulse")

| View | Columns | Note |
|---|---|---|
| `quality_market_pulse_history` | `trading_date`, `value` (base 100), `daily_change_percent`, `constituent_count`, `data_quality` | Verified series, current and previous calendar year, restarts after a coverage gap. Use this one |
| `market_pulse_history` | `trading_date`, `value`, `daily_change_percent`, `constituent_count` | Legacy unverified series |

Both read history through definer helpers, so they are identical for every tier.

### 3.6 Intraday charts — auth only

| Surface | Access |
|---|---|
| RPC `get_intraday_chart(requested_security_id uuid)` -> jsonb | auth |
| RPC `get_intraday_trade_chart(requested_security_id uuid)` -> jsonb | auth (fallback used internally) |
| RPC `get_intraday_price_history(requested_security_id uuid, requested_trading_date date)` -> rows | auth |
| RPC `bodiva_chart_session(observed_at timestamptz default now())` -> `(trading_date, opens_at, closes_at)` | auth |
| Table `market_price_candles_5m` | auth |
| Table `market_quote_observations` (`security_id`, `observed_at`, `price`, `source_request_id`) | auth |
| Table `intraday_sync_state`, columns `security_id`, `last_attempt_at`, `last_success_at`, `last_trade_at`, `consecutive_failures` only | auth |

**Signed-out callers get no intraday data.** A public website chart can only use daily history.

`get_intraday_chart` response:

| Key | Value |
|---|---|
| `source` | `trades` or `observations` |
| `session_date` | date actually shown |
| `requested_session_date` | current (or most recent) session |
| `last_checked_at`, `last_trade_at` | timestamps or null |
| `status` | trades: `ready`, `no_trades`, `stale`. observations: `observed`, `stale` |
| `points[]` | `security_id`, `bucket_at`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `traded_amount`, `trade_count` |

For `source = "observations"` only `bucket_at` and `close_price` are set; a single point is legal. Candles are 5-minute buckets, numeric(20,8). Error: plain exception "Unknown instrument" for an inactive/unknown id.

### 3.7 Order book

| Surface | Columns |
|---|---|
| `latest_order_books` (view) | `id`, `security_id`, `trading_date`, `order_book_levels` jsonb array of `{side, level, price, quantity, order_count}` ordered by side, level. Latest accepted market day only |
| `quality_latest_order_books` (view) | above + `data_quality` |
| `order_books` | `id`, `trading_date`, `security_id`, `created_at` |
| `order_book_levels` | `id`, `order_book_id`, `side`, `level`, `price` numeric(24,8), `quantity` numeric(24,2), `order_count` |

RLS on `order_book_levels`: `level <= access_private.order_book_depth()`. When enforcement applies and the caller is not Pro, only levels 1..5 are visible, in the views too. Book `data_quality` is `valid` only while the market is open and the book was observed within 2 minutes; otherwise `unknown/missingProvenance` and the client should hide levels as "current".

### 3.8 Calendar and session

| RPC | Access | Returns |
|---|---|---|
| `bodiva_market_status(observed_at timestamptz default now())` | anon, auth | text: `open`, `opening_soon` (trading day before open), `closed`, `unknown` |
| `get_market_calendar(starts_on date, ends_on date)` | anon, auth | jsonb, or null when outside verified coverage or span >= 400 days |
| `get_home_market_calendar()` | anon, auth | jsonb, one day, legacy v1 |
| `get_available_market_wraps(observed_at timestamptz default now())` | anon, auth | rows `period_type` (`weekly|monthly|yearly`), `starts_on`, `ends_on`, `available_at`, `expires_at` |

`get_market_calendar` document: `contract_version: 2`, `timezone`, `version` (md5), `source`, `fetched_at`, `valid_until` (<= fetched + 2 min), `starts_on`, `ends_on`, `regular_weekdays` (1=Sunday..7=Saturday, i.e. ISO day % 7 + 1), `opens_at`, `closes_at`, `days[]` of `{day, kind, opens_at, closes_at, revision}`. `kind`: `regular`, `non_trading`, `holiday`, `exceptional_closure`, `exceptional_session`, `unknown`.

`get_home_market_calendar`: `contract_version: 1`, `fetched_at`, `valid_until`, `day`, `has_override`, `is_open` (null when unknown), `opens_at`, `closes_at`, `revision`.

Facts: timezone `Africa/Luanda` (UTC+1, no DST). Reviewed hours **09:25-15:00**, Monday-Friday (`20260928184007`); schema defaults of 09:00-15:30 in older docs/README are stale. Coverage: 2026 verified; 2027 provisional with `valid_until = 2027-02-01 00:00 Luanda` (`20261112170000`). After that instant without an operator update, status, calendar and every quote go `unknown`. `bodiva_trading_calendar` itself is not client-readable.

Wrap windows (`docs/market-wrap-release-windows.md`, `20261009234500`): available 20 minutes after close. Weekly: from Friday close + 20 min until Monday 00:00 Luanda. Monthly/yearly: 72 hours.

### 3.9 Listing events

**`market_events`** (table, anon + auth SELECT): `id`, `event_key`, `kind` (`new_listing` only), `issuer_id`, `security_id` (null until confirmed), `title`, `scheduled_date`, `starts_at`, `expires_at`, `status` (`scheduled|confirmed|cancelled`), `effective_at`, `confirmation_url`, `source_url`, `source_name`, `priority` (0..1000), `highlights_home`, `notifications_enabled`, `created_at`, `updated_at`. Show a highlight only between `starts_at` and `expires_at`.

`market_event_receipts` (`event_id`, `user_id`, `created_at`): auth SELECT own rows.

### 3.10 Unusual activity

**RPC `get_unusual_activity(requested_date date default null)`** (anon, auth): up to 200 rows for the date (default: latest date with events), newest first: `id`, `security_id`, `symbol`, `name`, `security_type`, `trading_date`, `rule`, `observed_value`, `baseline_value`, `baseline_sessions`, `data_source`, `facts`, `occurred_at`, `status` (`active|withdrawn`), `withdrawn_at`.

`rule`: `volume_spike`, `trade_count_spike`, `price_move`, `dormancy_break`, `spread_change`, `large_trade`, `large_order`, `spread_shift`, `book_imbalance`. `facts` keys used by server copy: `symbol`, `name`, `securityKind` (`share|bond|fund_unit|unit`), `quantity`, `price`, `side` (`buy|sell`), `orderValue`, `ratio`, `tradeCount`, `changePercent`, `zScore`, `dormantSessions`, `direction` (`wider|narrower`). Full per-rule fact list UNVERIFIED (detectors in `_shared/unusual_activity/*.ts`). Withdrawn orders should render struck through. Table `unusual_activity_events` is also directly readable (mock rows hidden by RLS).

### 3.11 News and recaps

| Table | Client access | Columns |
|---|---|---|
| `news_articles` | anon/auth SELECT where `status='published' and published_at <= now()` | `id`, `slug`, `title`, `summary`, `body_markdown` (<= 256 KiB), `status`, `author_id`, `updated_by`, `published_at`, `created_at`, `updated_at`, `archived_at`, `revision`, `recap_period` (`weekly|monthly|annual` or null), `period_start`, `period_end`, `reference_session` |
| `news_article_sources` | SELECT when the article is visible | `article_id`, `source_id`, `source_url`, `source_title`, `is_primary`, `accessed_at` |
| `news_article_categories` | same | `article_id`, `category_id` |
| `news_article_securities` | same | `article_id`, `security_id` |
| `news_sources`, `news_categories` | SELECT all | `id`, `name` |
| `market_recaps` | anon/auth SELECT where published | `id`, `trading_date`, `scope` (`equities`), `current_version`, `published_version`, `broadcast_version`, `article_id`, `published_at`, `push_deadline`, ... |

A daily recap is a `news_articles` row with slug `fecho-accoes-YYYY-MM-DD` linked from `market_recaps.article_id`. Weekly/monthly/annual reports are articles with `recap_period` set. Article language is the authored language (Portuguese); there is no translation.

Write access on these tables exists for `authenticated` but RLS restricts it to `editorial_members` with role `admin|editor`. Ordinary clients must treat them as read-only.

### 3.12 Feature configuration

**`intelligence_feature_configuration`** (anon/auth SELECT, single row `id = true`): `payload` jsonb, `updated_at`.

Payload: `schema_version` (1), `version`, `minimum_app_build`, `effective_at`, `expires_at` (lifetime <= 7 days), `features{<flag>: {enabled, kill_switch, rollout_percentage, rollout_salt, audiences[]}}`. Audiences: `production`, `beta`, `internal`.

Flags: `insight_engine`, `snapshot_capture`, `market_events`, `weekly_wrap`, `saturday_discover`, `week_ahead`, `personalized_home`, `activity_center`, `intelligence_notifications`, `personalization_engine`, `personalization_v2`, `price_changes`, `watchlist_breadth`, `portfolio_performance`, `portfolio_allocation`, `watchlist_patterns`, `publications`, `notification_watchlist`, `notification_movement`, `notification_market_recap`.

Rollout bucket: FNV-1a 32-bit over UTF-8 `identity|feature|salt`, modulo 10000; included when `bucket < rollout_percentage * 100`. Fixture: `fixture-install|weekly_wrap|phase19` -> 8065 (`docs/intelligence-feature-controls-phase19.md`). Client identity is a locally generated install UUID; the server uses the account id. Missing, invalid or expired document: optional features and all optional pushes are off. Saturday Discover and Week Ahead are client features behind flags; no dedicated server surface exists for them.

---

## 4. Account data (auth only, owner RLS `auth.uid() = user_id`)

### 4.1 Watchlist

**`watchlist_items`**: PK `(user_id, security_id)`; `created_at`, `sort_order` int >= 0 default 0, `automatic_alerts_enabled` boolean default true.

| Operation | Allowed | Notes |
|---|---|---|
| SELECT, INSERT, DELETE | yes | |
| UPDATE | columns `sort_order`, `automatic_alerts_enabled` only | Changing `user_id`/`security_id` raises `23514` "Watchlist identity is immutable" |

| Rule | Error |
|---|---|
| 500 rows per account | `23514` "Account resource limit reached (500)" |
| Free under enforcement: 4th insert | `P0001` `FREE_WATCHLIST_LIMIT`, details `{"feature":"watchlist","limit":3}` |
| Free: insert while another row has alerts on | silently stored with `automatic_alerts_enabled = false` |
| Free: enabling alerts on a second row, or on a row outside the active three | `P0001` `FREE_MOVEMENT_LIMIT`, details `{"feature":"movement_alerts","limit":1}` |

| RPC | Args | Returns | Errors |
|---|---|---|---|
| `reorder_watchlist` | `security_ids uuid[]` (exactly the current membership, in the new order) | void | `28000`; `22023` "Duplicate or null securities"; `22023` "Watchlist membership changed; reload before reordering" |
| `select_free_watchlist` | `security_ids uuid[]` (<= 3, must be saved, count = min(3, saved)), `movement_id uuid default null` (must be in the list) | `get_subscription_access()` payload | `28000`; `22023` "Invalid Free selection"; `22023` "Choose up to three saved instruments" |

The Free "active" subset is the first three rows by `sort_order, created_at, security_id`. Rows beyond it stay stored and readable; the server returns the active ids in `get_subscription_access().active_watchlist_ids`.

### 4.2 Watchlist groups (`20261110100000`)

| Table | Columns | Operations |
|---|---|---|
| `watchlist_groups` | `id`, `user_id`, `name` (1..40 trimmed chars, unique per user case-insensitive), `created_at` | SELECT, INSERT, DELETE; UPDATE `name` only |
| `watchlist_group_items` | `group_id`, `user_id`, `security_id`, `created_at`; PK `(group_id, security_id)` | SELECT, INSERT, DELETE |

A member must already be in `watchlist_items` (FK); removing the watchlist item removes its group memberships. Errors on INSERT: `P0001` `PLUS_REQUIRED` details `{"feature":"watchlist_groups"}` (Free under enforcement); `P0001` `WATCHLIST_GROUP_LIMIT` details `{"feature":"watchlist_groups","limit":20}`.

### 4.3 Alert rules

**`notification_rules`**: `id`, `user_id`, `security_id`, `kind`, `threshold` numeric(24,8), `is_enabled` default true, `last_triggered_at`, `created_at`, `updated_at`. Unique `(user_id, security_id, kind, threshold)`. Full CRUD.

| `kind` | `threshold` | Fires when (`notification_private.rule_condition_met`, `20261110090100`) |
|---|---|---|
| `price_above` | price | `last_price >= threshold` |
| `price_below` | price | `last_price <= threshold` |
| `percent_change_above` | percent | verified change `>= threshold` |
| `percent_change_below` | percent | verified change `<= threshold` |
| `high_52w` | must be `1` | last price above the 365-day high (needs >= 20 history rows) |
| `low_52w` | must be `1` | last price below the 365-day low |
| `volume_above_average` | `1.5..20` | volume >= threshold x average of last 20 traded sessions (needs >= 5) |
| `days_without_trades` | integer `1..365` | no trade for that many calendar days; once per inactive stretch |

Evaluation only on quotes with `data_quality.status = 'valid'`. Limits: 100 rules per account (`23514`); Free under enforcement: 2 rules, `P0001` `PLUS_REQUIRED` details `{"feature":"alert_rules","limit":2}`. A rule is not auto-disabled after firing; the same rule and quote row never produce a second delivery.

### 4.4 Notification inbox

Primary inbox: **`account_notifications`** (SELECT own).

| RPC | Args | Returns |
|---|---|---|
| `get_account_notifications` | `page_size int default 50` (clamped 1..100), `before_created_at timestamptz default null`, `before_id uuid default null` | `setof account_notifications`, newest first, last 28 days, only rows with `composition` set. Keyset: pass the last row's `created_at` and `id` together |
| `acknowledge_account_notifications` | `notification_ids uuid[]` (<= 100), `opened boolean default false` | `uuid[]` of rows changed. Sets `read_at`, and `opened_at` when `opened`. Also marks linked recap receipts and legacy deliveries read. Errors `42501` "Authentication required", `22023` "Too many notifications" |
| `get_portfolio_notification_evidence` | `notification_id uuid` | jsonb evidence for a `portfolio_daily` notification, or null |

Row columns: `id`, `user_id`, `semantic_key`, `category`, `movement_event_id`, `listing_event_id`, `recap_receipt_id`, `portfolio_event_id`, `security_id`, `article_id`, `wrap_starts_on`, `unusual_event_id`, `unusual_digest_on`, `close_on`, `occurred_at`, `created_at`, `content_revision`, `content_state` (`active|withdrawn|unavailable`), `significance` (`notable|significant|exceptional`), `facts`, `relevance` (`{watched?, held?}`), `composition`, `preview_composition`, `hook_family`, `playful`, `copy_catalogue_version`, `policy_version`, `push_state` (`pending|deferred|scheduled|suppressed|expired`), `push_reason`, `not_before`, `push_expires_at`, `attempt_expires_at`, `read_at`, `opened_at`, plus two lease columns.

`composition` (in-app copy) and `preview_composition` (lock-screen copy): `catalogueVersion`, `strategyId`, `hookId`, `hookFamily`, `factClauseId`, `closerId`, `title`, `body`, `accessibilityText`, `privacyClass` (`public_market|personal_context|private_financial`), `playful`. Stored copy is Portuguese (pt-AO).

| `category` | Routing ids | `facts` keys |
|---|---|---|
| `asset_movement` | `security_id`, `movement_event_id` | `eventFamily:"movement"`, `direction` (`up|down`), `percentage`, `signedPercentage` (e.g. `+3,2`), `comparison` (`previous_close|intraday_5m`), `referenceDate`, `previousPrice`, `currentPrice`, `symbol`, `issuer`, `securityType`, `capabilities[]` |
| `market_listing` | `security_id`, `listing_event_id` | `eventFamily:"listing"`, `issuer`, `symbol`, `capabilities` |
| `market_recap` | `article_id`, `recap_receipt_id` | `eventFamily:"recap"`, `title`, `body` |
| `portfolio_daily` | `portfolio_event_id` | private; details via `get_portfolio_notification_evidence` |
| `news_publication` | `article_id` | `eventFamily:"publication"`, `title`, `body` |
| `weekly_wrap` | `wrap_starts_on` (a Monday) | `eventFamily:"wrap"` |
| `unusual_activity` | `security_id` + `unusual_event_id`, or `unusual_digest_on` | event facts + `rule`, `eventId`, `tradingDate`, `name`, `signalCount`; digest has `rule:"digest"`, `symbols[]` |
| `daily_close` | `close_on` | `eventFamily:"daily_close"`, `tradingDate`, `advancers`, `decliners`, `unchanged`, `topSymbol`, `topChangePercent`, Plus only: `watchedAdvancers`, `watchedDecliners`, `watchedCount` |

Retention: rows deleted after 28 days (`maintain_account_notifications`).

Legacy inbox: **`notification_deliveries`** (SELECT own; UPDATE `is_read` only). Still the record for explicit `alert_rule` deliveries: `id`, `rule_id`, `security_id`, `delivery_kind`, `status`, `current_price`, `previous_price`, `event_change_percent`, `alert_snapshot` (rule kind and threshold frozen at match time), `alert_expires_at`, `is_read`, `delivered_at`, `created_at`, plus transport columns (`apns_id`, `attempt_count`, `error_code`, ...). There is one row per device, so de-duplicate by `(rule_id, market_price_id)`.

`market_recap_receipts` (`id`, `recap_id`, `version`, `user_id`, `is_read`, `created_at`): SELECT own, UPDATE `is_read`.

### 4.5 Notification preferences

| Table | Columns (defaults) | Operations |
|---|---|---|
| `notification_preferences` | `watched_movements_enabled` (true), `held_asset_movements_enabled` (true), `portfolio_daily_enabled` (true), `listings_enabled` (true), `public_previews_enabled` (true), `daily_close_enabled` (**false**), `updated_at` | SELECT, INSERT, UPDATE (upsert on `user_id`) |
| `user_movement_preferences` | `sensitivity` (`low|normal|high`, default `normal`) | SELECT, INSERT, UPDATE of `user_id`, `sensitivity` |
| `unusual_activity_preferences` | `notifications_enabled` (true), `disabled_rules text[]` (subset of the nine rule names) | SELECT, INSERT, UPDATE of `user_id`, `notifications_enabled`, `disabled_rules` |
| `user_recap_preferences` | `enabled` (false), `enabled_at`, `updated_at` | SELECT only; write through RPC |

RPC `set_market_recap_preference(wants_recaps boolean)` -> the `user_recap_preferences` row. Error `28000`.

No row means defaults apply. Daily close and market recaps are opt-in.

### 4.6 Devices

`device_tokens` is readable and writable by its owner through PostgREST, but registration must go through `register-device` (section 9.2), which enforces token ownership transfer and validation. Columns: `id`, `user_id`, `device_id`, `apns_token`, `app_bundle_id`, `environment`, `app_version`, `build_number`, `notifications_enabled`, `market_recap_capable`, `notification_payload_version`, `notification_localization_version`, `notification_language`, `unusual_activity_capable`, `daily_close_capable`, `last_seen_at`, `created_at`, `updated_at`. Limit 20 per account.

### 4.7 Profile

`user_profiles` (`user_id`, `display_name`, `is_admin`, `created_at`, `updated_at`): SELECT own; UPDATE `display_name`. No INSERT policy and no creation trigger was found, so a row may not exist for a new user. UNVERIFIED whether anything creates it.

### 4.8 Activity counters (personalisation)

**`user_activity_daily`** (SELECT, INSERT, UPDATE own): `id`, `user_id`, `installation_id` uuid, `activity_day` date, `kind`, `security_id`, `related_security_id`, `variant`, `activity_count` (1..1000). Unique on all dimension columns, so upsert.

| `kind` | Required shape |
|---|---|
| `asset_view`, `search_select`, `watchlist_add`, `watchlist_remove` | `security_id`, `variant = ''` |
| `comparison` | `security_id`, different `related_security_id`, `variant = ''` |
| `chart_range` | `security_id`, `variant` in `1D`, `1S`, `1M`, `3M`, `6M`, `1A`, `Tudo` |
| `wrap_open` | no ids, `variant = ''` |
| `wrap_available`, `wrap_opened`, `wrap_completed`, `wrap_abandoned`, `wrap_shared` | no ids, `variant` matches `weekly-YYYY-MM-DD` |

`activity_day` must be within the last 112 Luanda days. No search text or amounts.

### 4.9 Wrap evidence (auth)

| RPC | Args | Notes |
|---|---|---|
| `get_weekly_wrap_evidence` | `starts_on date` (Monday), `ends_on date` (start + 4 or + 6) | Not older than 35 days. `contract_version: 2` |
| `get_market_period_evidence` | `starts_on`, `ends_on`, `requested_kind` (`weekly|monthly|yearly`) | `contract_version: 3`. Yearly ends 24 December |

Response: `contract_version`, `fetched_at`, `calendar_snapshot`, `baseline_day`, `calendar[]` (`day`, `is_open`, `opens_at`, `closes_at`, `revision`), `observations[]` (`record_id`, `asset_id`, `currency_code`, `price` as string, `observed_at`, `collected_at`, `ingestion_run_id`, `source_sha256`, `parser_version`, `dataset`, `data_quality`, `is_final`). Errors: `42501` "Authentication required"; `22023` "Invalid weekly interval" / "Invalid trading interval" / "Calendar coverage unavailable" / "Trading week has incomplete sessions" / "Weekly interval omits trading sessions". The client computes the Wrap; only `is_final` rows are usable.

---

## 5. Portfolio (auth)

### 5.1 Ledger

**`portfolio_transactions`**: `id` uuid, `user_id`, `security_id`, `transaction_kind`, `quantity` numeric(24,8) > 0, `unit_price` numeric(24,8) > 0, `fees` numeric(24,8) >= 0 default 0, `traded_on` date, `portfolio_id` uuid null (null = main portfolio), `created_at`, `updated_at`. Direct INSERT/UPDATE/DELETE with owner RLS.

| Rule | Error |
|---|---|
| Instrument must be `stock`, `fund`, `treasury_bond` or `bond`, currency `AOA`; stock quantity whole; no NaN; `created_at` not in the future | `23514` "Unsupported portfolio instrument or quantity" |
| `id`, `user_id`, `security_id`, `created_at`, `portfolio_id` immutable on UPDATE | `23514` "Portfolio transaction identity cannot change" |
| A sale may not exceed the quantity held in that portfolio at its point in ledger order (pre-existing deficits may stay or improve) | `23514` "Portfolio sale exceeds holdings" |
| `traded_on` not after today in Luanda | `22007` "portfolio transaction date cannot be in the future" |
| `income`: `quantity = 1`, `fees <= unit_price` | check violation `23514` |

Field meaning (`docs/portfolio-ledger-contract.md`): bonds store nominal AOA in `quantity` and percent of nominal in `unit_price` (value = quantity x price / 100). Income stores the gross payment in `unit_price` and withheld tax in `fees`.

**RPC `get_portfolio_ledger_page(expected_revision bigint default null, after_traded_on date default null, after_created_at timestamptz default null, after_id uuid default null)`** -> `{"revision": "<string>", "transactions": [...]}`.

- Page size fixed at 500, order `traded_on, created_at, id`.
- Row keys: `id`, `security_id`, `transaction_kind`, `quantity`, `unit_price`, `fees`, `traded_on`, `created_at`, `portfolio_id`.
- First page: no args. Next pages: pass the returned `revision` as `expected_revision` and the last row's three cursor fields. Stop when a page has fewer than 500 rows.
- The revision is per account and bumps on every write in any portfolio.
- Errors: `42501` "Authentication required"; `22023` "Invalid ledger cursor"; `PT409` "Portfolio changed; reload before calculating totals" -> restart from page one.

Calculation contract: every client must pass `contracts/portfolio-ledger.v1.json` (8 golden cases, decimals as strings). Rules: process per instrument in ledger order with exact decimals; scale 0.01 for `bond`/`treasury_bond`, else 1. Buy: `quantity += q`, `cost += q*price*scale + fees`. Sell: `realized += q*price*scale - fees - q*avg`, `quantity -= q`, `cost -= q*avg`. Income: `net_income += price - fees`. Any invalid record or oversell invalidates the whole ledger. Results group by calendar year of `traded_on`, newest first. With named portfolios, apply the rules per `portfolio_id` (server validates balances per portfolio).

### 5.2 Named portfolios

**`portfolios`**: `id`, `user_id`, `name` (1..40 trimmed, unique per user case-insensitive), `created_at`. SELECT, INSERT, DELETE; UPDATE `name`. Deleting a portfolio cascades its transactions, cash movements and shares.

Errors on INSERT: `P0001` `PLUS_REQUIRED` details `{"feature":"portfolios"}`; `P0001` `PORTFOLIO_LIMIT` details `{"feature":"portfolios","limit":9}`.

### 5.3 Cash

**`portfolio_cash_movements`**: `id`, `user_id`, `portfolio_id` null, `kind` (`deposit|withdrawal|fee`), `amount` numeric(24,8) > 0, `occurred_on` date, `created_at`. SELECT, INSERT, DELETE; UPDATE `kind`, `amount`, `occurred_on`.

Errors: `23514` "Cash movement cannot be in the future"; INSERT by Free under enforcement `P0001` `PLUS_REQUIRED` details `{"feature":"cash"}`. Cash balance is computed by the client; the server stores movements only. Cash rows are not part of the ledger revision.

### 5.4 Shared read-only views (Pro)

| Surface | Access | Contract |
|---|---|---|
| RPC `create_portfolio_share(share_portfolio_id uuid, share_label text)` | auth | Returns `{"id": uuid, "token": "<32 url-safe chars>"}`. The token is shown once; only its SHA-256 is stored. `share_portfolio_id = null` shares the main portfolio |
| Table `portfolio_shares` | auth | SELECT `id`, `user_id`, `portfolio_id`, `label`, `created_at`; DELETE to revoke. Request explicit columns: `select=*` fails because `token_hash` is not granted |
| RPC `get_shared_portfolio(share_token text)` | **anon**, auth | `{"portfolio": <name or null>, "transactions": [{id, security_id, transaction_kind, quantity, unit_price, fees, traded_on, created_at}]}` or `null` |

`create_portfolio_share` errors: `28000`; `P0001` `PRO_REQUIRED` details `{"feature":"clientViews"}`; `P0001` `PORTFOLIO_NOT_FOUND`; `P0001` `SHARE_LIMIT` details `{"limit":20}`; label must be 1..40 chars.

`get_shared_portfolio` returns `null` for a malformed token (`^[A-Za-z0-9_-]{32}$`), unknown token, or when the owner is no longer Pro under enforcement. It is not paginated and exposes no cash. This is the natural web deep-link surface.

---

## 6. Not client-callable (do not use)

Service-role or cron only: `ingest_market_snapshot*`, `ingest_bodiva_dataset*`, `ingest_market_trade_ticks`, `replace_order_books`, `record_market_quote_observations`, `reconcile_current_market_prices_from_ticks`, `confirm_market_close`, `revalidate_market_summary_observation`, `claim_*`/`finish_*`/`release_*` lease RPCs, `sync_security_catalog`, `record_reference_price_verification`, `prepare_reference_price_recovery`, `get_reference_price_recovery_targets`, `read_market_snapshot`, `claim_market_snapshot_refresh`, `store_market_snapshot`, `build_current_market_quotes`, `build_latest_verified_market_closes`, `build_market_snapshot_extras`, `register_push_installation*`, `queue_*_deliveries`, `claim_notification_deliveries`, `notification_delivery_is_eligible*`, `detect_notification_movements`, `evaluate_*`, `capture_notification_baselines`, `produce_account_notifications*`, `claim_notification_compositions`, `finish_notification_composition`, `schedule_account_notifications`, `begin_*_transport`, `finish_account_notification_transport`, `account_notification_preview_allowed`, `claim_silent_refresh_targets`, `maintain_account_notifications`, `notification_orchestration_control`, `notification_platform_health`, `apply_subscription_snapshot` (both overloads), `reserve_subscription_sync`, `subscription_webhook_processed`, `record_unusual_activity`, `unusual_activity_*_inputs`, `generate_market_recap_candidate`, `record_market_recap_evidence`, `get_intelligence_health`, `record_intelligence_pipeline_run`, `intelligence_*` helpers, `market_close_pending`, `apply_reviewed_market_data_repair`, `refresh_product_activity_daily`, `hook_before_user_created` (auth admin only).

Tables with no client grant: `apple_web_deletion_states`, `bodiva_trading_calendar`, `dataset_health`, `ingestion_runs`, `ingestion_diagnostics`, `intelligence_pipeline_runs`, `intraday_backfill_checkpoints`, `manual_refresh_requests`, `market_alert_events`, `market_ingestion_locks`, `market_price_changes`, `market_trade_ticks`, `movement_alert_config`, `product_activity_daily`, `reference_price_recovery_*`, `security_catalog_*`, view `quality_price_history`, and everything in private schemas.

Editorial portal only (auth + `editorial_members` role, not for the app or website): `save_news_article`, `save_period_market_recap`, `preview_market_recap`, `review_market_recap_candidate`, `publish_market_recap`, `start_market_recap_correction`, `approve_assistant_prepared_article`, `current_editorial_role`, tables `editorial_members`, `news_audit_log`, `market_recap_versions`, and Edge Function `capture-recap-evidence`.

Executable by client roles only as a side effect of old default grants, not part of the contract: `bodiva_security_type`, `bodiva_source_data_status`, and trigger functions `set_updated_at`, `derive_market_price_change_percent`, `sync_market_price_history`, `normalize_bodiva_security_type`, `clear_market_source_metadata`.

---

## 7. Subscriptions and limits

### 7.1 Tiers and products

| Tier | How obtained | Product ids (`_shared/subscriptions.ts`) |
|---|---|---|
| Free | default | |
| Plus | RevenueCat entitlement `plus`; or lifetime gift; or referral credit | `ao.invest.plus.monthly`, `ao.invest.plus.annual` |
| Pro | RevenueCat entitlement `pro` (or `plus` entitlement on a pro product) | `ao.invest.pro.monthly`, `ao.invest.pro.annual` |

Pro implies Plus (`has_plus` accepts any active entitlement row). Gifts and referral credits grant Plus only. `docs/subscriptions.md` predates Pro and still says "no lifetime product" and lists only Plus products; code wins.

### 7.2 How entitlement is established

1. The client purchases through the RevenueCat SDK with `app_user_id` = the Supabase user UUID (the server looks the subscriber up by lower-cased user id).
2. The client calls `POST /functions/v1/sync-subscription` (section 9.3). The server fetches `GET https://api.revenuecat.com/v1/subscribers/<uuid>` with `REVENUECAT_SECRET_API_KEY` and stores one snapshot per environment (`production`, `sandbox`) in `subscription_private.entitlements` (`user_id`, `environment`, `is_active`, `expires_at`, `observed_at`, `tier`). Older snapshots never overwrite newer ones.
3. RevenueCat also calls `revenuecat-webhook`, which triggers the same reconciliation for every alias in the event.
4. The client reads `get_subscription_access()`.

Nothing the client sends grants access. No App Store Server API or receipt handling exists in this backend; RevenueCat is the only verifier. Expiry is checked at read time (`expires_at > now()`), with billing grace folded into expiry.

The snapshot parser **accepts only `store === "app_store"`** and only the four product ids above. A subscriber whose active entitlement comes from `play_store`, `stripe` or `rc_billing` makes the parser throw `502 BILLING_RESPONSE_INVALID` and stores nothing.

Environment: `subscription_private.control.environment` (default `production`) selects which snapshot counts. Accounts listed in `subscription_private.sandbox_accounts` use sandbox snapshots and are always enforced.

### 7.3 `get_subscription_access()` (auth) -> jsonb

| Key | Type | Meaning |
|---|---|---|
| `is_plus` | boolean | Plus or Pro, gift, or running credit |
| `is_pro` | boolean | Active Pro entitlement |
| `plus_credit_until` | timestamptz or null | End of referral credit |
| `lifetime_gift` | `{id, owner_name}` or null | Active gift |
| `enforcement_enabled` | boolean | Limits apply to this account |
| `week_start` | date | Monday of the current Luanda week |
| `resets_at` | timestamptz | Next Monday 00:00 Luanda |
| `comparison_pair` | `[uuid, uuid]` or null | Free pair claimed this week |
| `active_watchlist_ids` | uuid[] | Rows that count for a Free account |
| `movement_security_id` | uuid or null | The instrument with active movement alerts |

Error `28000` when signed out. Key set confirmed by replaying the two `do $$` patches in `20261111090000` and `20261112090000`.

Other RPCs:

| RPC | Args | Returns / errors |
|---|---|---|
| `authorize_chart_comparison` | `security_ids uuid[]` (2..3 distinct, active, same asset class) | Access payload. `22023` "Invalid comparison instruments" / "Incompatible comparison instruments"; `P0001` `FREE_COMPARISON_SIZE_LIMIT` (Free may compare 2); `P0001` `FREE_COMPARISON_WEEK_LIMIT` (one pair per week; the same pair may be re-authorised); `P0001` `COMPARISON_DATA_UNAVAILABLE` |
| `claim_lifetime_plus_announcement` | none | `{id, owner_name}` once per account, else null |
| `get_referral` | none | `{code, can_redeem, credit_until}` or null when referrals are closed. Code: 8 chars from `A-HJ-NP-Z2-9`, created lazily |
| `redeem_referral_code` | `referral_code text` (normalised: non-alphanumerics stripped, upper-cased) | `{credit_until}`. `P0001`: `REFERRALS_UNAVAILABLE`, `REFERRAL_CODE_INVALID`, `REFERRAL_OWN_CODE`, `REFERRAL_ALREADY_USED`, `REFERRAL_NOT_ELIGIBLE` |

Referral mechanics: referee must be an account younger than 30 days with no previous redemption; gets one month of Plus immediately (queued after any running credit). The referrer gets one month when the referee has an active paid entitlement (trigger on `entitlements`, or at redemption), up to `referral_reward_cap` (default 12). Referrals are open only when `referrals_enabled and enforcement_enabled`.

### 7.4 Limits and where they are enforced

"Enforced" means `subscription_private.enforcing(user)`: global `control.enforcement_enabled` (migration default **false**; live value UNVERIFIED) or the account is a sandbox tester. Signed-out callers follow the global flag.

| Limit | Free / signed out | Plus | Pro | Enforced in |
|---|---|---|---|---|
| Daily history range | last 1 year | all | all | RLS on `price_history` |
| Order book depth | levels 1-5 | 1-5 | all | RLS on `order_book_levels` |
| Watchlist size | 3 active (rows beyond stay stored) | 500 | 500 | trigger `subscription_watchlist_limit`, `limit_watchlist` |
| Automatic movement alerts | 1 instrument | all watched | all | same trigger + delivery eligibility |
| Alert rules | 2 | 100 | 100 | triggers on `notification_rules` |
| Chart comparison | 2 instruments, 1 pair per week | 3, no quota | 3 | `authorize_chart_comparison` (advisory quota; history itself stays readable) |
| Watchlist groups | none | 20 | 20 | trigger |
| Named portfolios | none | 9 | 9 | trigger |
| Cash movements | read/delete only | yes | yes | trigger |
| Shared portfolio views | no | no | 20 | `create_portfolio_share`, `get_shared_portfolio` |
| Daily close watchlist line | no | yes | yes | `produce_account_notifications` |
| Devices | 20 | 20 | 20 | trigger |
| Intraday chart | signed-in only, all tiers | | | grants |

---

## 8. Realtime

One topic, sent with the Realtime REST broadcast API by service code (`_shared/ingestion.ts`, `_shared/intraday_sync.ts`).

| Topic | Private | Event | Emitted | Payload |
|---|---|---|---|---|
| `market:prices` | **no** (`private: false`) | `quotes` | After a committed market-summary ingestion with rows, after the snapshot cache was warmed | `trading_date`, `run_id`, `collected_at`, `generated_at`, `etag` (of the new snapshot, either may be null), `changed_count`, `changed[]` (max 200) of `{symbol, last_price, change_percent, volume, trade_count}` as JS numbers |
| `market:prices` | no | `trades` | Once per `sync-intraday` run that inserted trades | `observed_at`, `instruments[]` of `{symbol, security_id, inserted}` |

- The brief described a "private broadcast topic"; the code sends a public one and the comment says "anyone may join the topic". No migration creates a policy on `realtime.messages`, and no table is added to a Realtime publication, so there are no `postgres_changes` streams. Hosted Realtime settings UNVERIFIED.
- Messages are hints. On `quotes`, refetch `market-snapshot` (compare `etag`). On `trades`, reload the intraday chart if the open instrument is listed. Do not render prices from the broadcast: values are lossy floats and unverified.
- A lost message costs one polling interval. Keep polling.
- There is no per-user Realtime channel. The inbox, watchlist and portfolio must be refetched.

---

## 9. Edge Functions

Error format for all: `{"error": {"code": "...", "message": "...", "details": ...}}`, `content-type: application/json`, `cache-control: no-store`. Unknown failures: 500 `INTERNAL_ERROR`. Wrong method: 405 `METHOD_NOT_ALLOWED` with `Allow`. Only `capture-recap-evidence` sends CORS headers.

| Function | Caller | Gateway JWT | Handler auth | Method |
|---|---|---|---|---|
| `market-snapshot` | clients | off | none (`?refresh=1` needs cron secret) | GET |
| `health` | anyone | off | none | GET |
| `register-device` | client | on | user JWT | POST |
| `unregister-device` | client | on | user JWT | POST, DELETE |
| `sync-subscription` | client | off | user JWT | POST |
| `delete-apple-account` | client | off | user JWT | POST |
| `apple-web-deletion` | client `/start`, Apple `/callback` | off | JWT on start; one-time state on callback | POST |
| `revenuecat-webhook` | RevenueCat | off | exact `Authorization` = `REVENUECAT_WEBHOOK_AUTHORIZATION` | POST |
| `admin-refresh-market` | admin | on | JWT + admin app_metadata; 1 per 5 min | POST `{tradingDate?}` |
| `capture-recap-evidence` | editorial portal | on | JWT + editor role | POST |
| `ingest-market-data`, `sync-intraday`, `sync-security-catalog`, `sync-reference-prices`, `orchestrate-notifications`, `process-notifications` | cron | off | header `x-cron-secret` = `CRON_SECRET` | POST |
| `intelligence-health` | external monitor | off | `x-cron-secret` | GET |

With the gateway check on, also send the `apikey` header as usual. When the gateway rejects a token, the error body is the platform's, not the format above.

### 9.1 `market-snapshot`

`GET /functions/v1/market-snapshot`, optional `If-None-Match`.

Response 200 body:

| Key | Content |
|---|---|
| `contract_version` | 1 (new keys are added without bumping) |
| `generated_at`, `fresh_until` | ISO-8601 UTC, whole seconds |
| `securities[]` | `id`, `symbol`, `isin`, `name`, `currency`, `security_type`, `issuer_id`, `is_active` (whole catalogue, anon view) |
| `quotes` | full `get_current_market_quotes` payload (section 3.3) |
| `closes` | rows of `latest_verified_market_closes`, or null |
| `pulse` | 30 newest `quality_market_pulse_history` rows, newest first, or null |
| `calendar` | `get_market_calendar` from 4 weeks before this week's Monday to 20 days after it, or null |
| `control` | `{maintenance: boolean, min_poll_seconds: number}` or null |

Headers: `ETag` (strong, quoted SHA-256), `Cache-Control: public, max-age=<s>, stale-while-revalidate=5`, `X-InvestAO-Generated-At`. `304` on a matching `If-None-Match`.

TTL: 90 s market open, 300 s closed, 15 s when closes or extras failed, always capped by the earliest future quote `validUntilEpoch`, minimum 1 s.

Errors: 503 `SNAPSHOT_UNAVAILABLE` (first build not ready). Every 5xx carries `retry_after_seconds: 30` in the body and `Retry-After: 30`.

Client rules: poll no faster than `control.min_poll_seconds`; show a maintenance state when `control.maintenance`; treat the bundled calendar as valid until `fresh_until` (its own `valid_until` is 2 minutes); still check each quote's `validUntilEpoch` against the device clock; on failure fall back to the three direct reads (`securities`, `get_current_market_quotes`, `latest_verified_market_closes`). No CORS headers are set by this function: a browser calling it cross-origin depends on platform behaviour (UNVERIFIED); a website should proxy it server-side or the function must add `withCors`.

### 9.2 `register-device` / `unregister-device`

`POST /functions/v1/register-device`, user JWT. Unknown keys are rejected.

| Field | Type | Rule | Default |
|---|---|---|---|
| `deviceId` or `installationId` | string | exactly one; trimmed; <= 128 chars | required |
| `apnsToken` | string | lower-cased; `^[a-f0-9]{64}$` | required |
| `bundleId` | string | must equal `ao.invest.iosapp` | required |
| `environment` | `sandbox` or `production` | APNs host; TestFlight and App Store use `production` | `sandbox` |
| `appVersion`, `buildNumber` | string or null | | null |
| `notificationsEnabled` | boolean | OS permission state | true |
| `marketRecapCapable` | boolean | | false |
| `unusualActivityCapable` | boolean | | false |
| `notificationPayloadVersion` | 1 or 2 | 2 = understands `notification_schema: 2` | 1 |
| `notificationLocalizationVersion` | 0 or 1 | 1 = ships the `loc-key` string catalogue | 0 |
| `notificationLanguage` | `pt` or `en` | when set, the server renders text in this language instead of relying on device loc-keys | unset |

Response 201: `{"device": <device_tokens row>}`.

| Status | Code | Message |
|---|---|---|
| 401 | `UNAUTHENTICATED` | missing or invalid token |
| 400 | `INVALID_JSON` | body not an object |
| 400 | `INVALID_INPUT` | `Unexpected field: <name>.`, `<name> is required.`, `Provide either deviceId or installationId, not both.`, `environment must be sandbox or production.`, type errors, `deviceId is too long.`, unsupported versions/language |
| 400 | `INVALID_APNS_TOKEN` | token format |
| 400 | `INVALID_TOPIC` | bundle id |
| 500 | `INTERNAL_ERROR` | includes the 20-device limit (`23514`) |

Semantics (`register_push_installation`): upsert on `(user_id, device_id)`; a token already registered to another user or device is moved (old row deleted). Call on every launch, token change, sign-in and permission change.

Known gap: SQL reads `dailyCloseCapable`, but the Edge parser rejects that key, so `daily_close_capable` can never become true through this function and daily-close pushes are never produced. The only current way to set it is a direct PostgREST UPDATE of the owner's `device_tokens` row. Whether iOS does that is UNVERIFIED.

`POST|DELETE /functions/v1/unregister-device`, body `{"deviceId": "..."}` or `{"installationId": "..."}`. Response 200 `{"deviceId": "...", "unregistered": true}` (also when nothing matched). Call before sign-out.

### 9.3 `sync-subscription`

`POST`, user JWT, no body. Response 200 `{"synchronized": true}`.

| Status | Code |
|---|---|
| 401 | `UNAUTHENTICATED` |
| 429 | `BILLING_RATE_LIMIT` (5 calls per account per minute) |
| 503 | `BILLING_NOT_CONFIGURED`, `BILLING_UNAVAILABLE`, `BILLING_SYNC_FAILED` |
| 502 | `BILLING_RESPONSE_INVALID` (includes non-App-Store purchases) |

Call after purchase, restore, and on app start when a paid state is expected; then call `get_subscription_access()`.

### 9.4 `health`

`GET /functions/v1/health` -> 200 `{"status":"ok","database":"reachable","latencyMs":<int>,"timestamp":"<ISO>"}`; 500 `INTERNAL_ERROR` when the database is unreachable. Reachability only; it says nothing about data freshness.

---

## 10. Push notifications

### 10.1 Pipelines

| Pipeline | Kinds | Queue | Worker |
|---|---|---|---|
| Account platform | `asset_movement` (delivery kinds `automatic_movement`, `intraday_movement`), `market_listing`, `portfolio_daily`, `news_publication`, `weekly_wrap`, `unusual_activity`, `daily_close`, `market_recap` | `account_notifications` -> `notification_deliveries` | `orchestrate-notifications` (detect, produce, compose, schedule) then `process-notifications` (send) |
| Explicit alerts | `alert_rule` | `notification_deliveries` | `process-notifications` |
| Silent refresh | background push for big watchlist moves | none (receipt only) | `orchestrate-notifications` |
| Legacy | `watchlist_price_change` and legacy recap/listing queues | disabled by the one-way cutover latch | |

Cron (UTC, `20261112200000`): every minute 07:00-19:59, every 3 minutes otherwise. Transport: 10 concurrent sends, 10 s timeout, up to 5 attempts, exponential retry from 60 s. Delivery is at-least-once; duplicates are possible.

### 10.2 Gating, quiet hours, budgets

| Control | Value |
|---|---|
| Quiet hours | 20:00-08:00 Luanda (`notification_private.control`). Listings and news are deferred to 08:00; other categories expire unsent |
| Daily budget | 5 per account per Luanda day, shared with explicit alerts; news, weekly wrap and daily close are exempt |
| Per instrument | 3 movement pushes per day; same-direction repeat needs escalation (+2 points or x1.5) within a 2-hour cooldown or the same day |
| Movement thresholds | sensitivity High/Normal/Low = 2% / 5% / 8%; max trade lag 30 min; windows `previous_close` and `intraday_5m` |
| Movement audience | market must be open; instrument watched (with alerts on) or held; Free: only `movement_security_id` |
| Weekly wrap | account >= 7 days old, one per week, expires with the Home window |
| Unusual activity | followers of the instrument; `large_trade`/`large_order` individually (expire after 1 h); session rules max 3 per follower per session plus one digest |
| Daily close | opt-in preference, device capability flag, before 20:00 |
| Feature config | Movement, listing, recap, portfolio, wrap and unusual pushes also require a valid unexpired `intelligence_feature_configuration` with `intelligence_notifications` on for the audience. Audience is derived from `device_tokens.environment`: `sandbox` -> `beta`, else `production` |
| Device | `notifications_enabled = true`; invalid tokens are auto-disabled |

Mode, rollout percentage and switches live in `notification_private.control` (service-only). Live values UNVERIFIED (docs record live at 100% on 30 Sep 2026).

### 10.3 APNs request

| Header | Value |
|---|---|
| `apns-topic` | `device_tokens.app_bundle_id` |
| `apns-push-type` | `alert` or `background` |
| `apns-priority` | 10 alert, 5 background |
| `apns-id` | stable per delivery |
| `apns-expiration` | notification attempt expiry |
| `apns-collapse-id` | notification id, else legacy delivery id, `recap-<id>`, `listing-<id>` |

Host from `environment`; on `BadDeviceToken` the other environment is tried once.

### 10.4 Alert payload (`privacySafeApnsPayload`, `_shared/apns.ts`)

| Key | Present | Use |
|---|---|---|
| `notification_schema` | `2` when payload version 2 | version switch |
| `notification_id` | v2 | `account_notifications.id`; acknowledge with it |
| `category` | v2 | routing (table in 4.4) |
| `preview_class` | v2 | `public_market` or `generic` |
| `copy_catalogue_version` | v2 | |
| `user_id` | always | drop the push if it is not the signed-in user |
| `legacy_delivery_id` | explicit alerts | `notification_deliveries.id` |
| `security_id` | when relevant | open instrument |
| `article_id` | news, recap | open article |
| `recap_receipt_id` | recap | mark read |
| `market_event_id` | listing | open listing |
| `wrap_period` | weekly wrap | `weekly-YYYY-MM-DD` |
| `personalization` | explicit and legacy only | `{version:1, kind: explicit_rule|verified_movement|approved_recap, fact_key, checked_at, expires_at}` (2-minute validity; foreground suppression hint) |
| `aps.alert.title`, `aps.alert.body` | always | see below |
| `aps.alert["title-loc-key"|"title-loc-args"|"loc-key"|"loc-args"]` | localization version 1 and no `notification_language` | device-side strings |
| `aps.sound` | `default` | |

Text rules:

- Generic (default for private or v1): title "Nova informação em invest.ao", body "Abra a aplicação para consultar a atualização.". Financial and personal details never appear on the lock screen; `portfolio_daily` is always generic.
- Public preview (v2 and category in movement, listing, recap, news, weekly wrap, unusual activity, daily close): the composed public title/body. For movement/listing it additionally requires the global and the user's `public_previews_enabled`. News, recap, weekly wrap, unusual activity and daily close are always sent as v2 with public text, whatever the device registered.
- Explicit alert rules always send the generic text; the real sentence ("O BAI atingiu 95 000,00 Kz.") is built server-side but not transmitted. The client renders the alert from `notification_deliveries` + `alert_snapshot`.

Background payload: `{"kind":"refresh","security_ids":[<= 50 uuids],"aps":{"content-available":1}}`, expires after 15 minutes, only for bundle `ao.invest.iosapp`.

### 10.5 Localization

Locales: `pt` and `en` (`_shared/notification_strings.json`). Stored inbox copy is Portuguese only. Three modes per device:

| Device registration | What is sent |
|---|---|
| `notificationLocalizationVersion: 0` | Portuguese `title`/`body` only |
| version 1, no `notificationLanguage` | Portuguese `title`/`body` plus loc-keys; the OS picks the string from the app bundle |
| version 1 with `notificationLanguage` | `title`/`body` rendered server-side in that language; no loc-keys |

Key families (format specifier `%@`, literal percent `%%`): `notification.generic.{title,body}`, `notification.movement.{title,body}`, `notification.listing.{title,body}`, `notification.news.title`, `notification.recap.title`, `notification.publication.body`, `notification.wrap.{title,body}`, `notification.close.{title,body,flat,watchlist}`, `notification.unusual.trade.{title,share,bond,fund_unit,unit}`, `notification.unusual.order.{buy,sell}.{title,body}`, `notification.unusual.session.{title,volume_spike,trade_count_spike,price_move.up,price_move.down,dormancy_break,spread_wider}`, `notification.unusual.digest.{title,one,two,more}`, `notification.voice.<hook-id>.title` (31 hooks from `product_voice/catalogue.v1.json`), `notification.voice.movement-fact.{close,intraday}`, `notification.voice.intraday-fact.body`, `notification.voice.listing-fact.body`. Numbers in args are pre-formatted in pt-AO style in every language.

### 10.6 Gap analysis — Android (FCM)

| Item | Today | Needed |
|---|---|---|
| Token storage | `device_tokens.apns_token` with check `^[A-Fa-f0-9]{64}$`; unique `(apns_token, environment)` | Migration: add `platform` (`ios|android|web`), a generic `push_token` (FCM tokens are ~150+ chars), relax the check per platform |
| Bundle check | constraint `supported_app_topic`, parser, `register_push_installation_before_platform` and `claim_silent_refresh_targets` all hard-code `ao.invest.iosapp` | Migration + parser change to accept the Android application id |
| `environment` | APNs host and audience (`beta`/`production`) | Decide Android mapping (debug/internal track -> `sandbox`) or add an explicit audience column |
| Registration API | `apnsToken` required; unknown keys rejected | Extend `register-device` with `platform` + `fcmToken` (or a new function). Also accept `dailyCloseCapable` |
| Transport | `_shared/apns.ts` only | New `_shared/fcm.ts` (HTTP v1, service-account OAuth), branch by platform in `account_notifications.ts`, `process-notifications`, `silent_refresh.ts`. Secret names: e.g. `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` (new). Map `UNREGISTERED`/`INVALID_ARGUMENT` to token disable |
| Payload | APNs `aps` shape | FCM data message carrying the same routing keys (10.4); `collapse_key` from notification id; TTL from expiry; high priority for alerts |
| Localization | APNs loc-keys | Simplest: register `notificationLanguage` so the server renders text. Alternative: Android `title_loc_key`/`body_loc_key` with the same keys in `strings.xml` and positional args (`%1$s`) |
| Capability flags | payload v2, recap, unusual, daily close | Android should register all as capable from day one |
| Silent refresh | APNs background push | FCM data-only message; update the hard-coded bundle filter |
| Repo rule | `AGENTS.md`: "Do not add Firebase packages ... FCM assumptions" | Needs an explicit owner decision before any FCM work |

### 10.7 Gap analysis — Web Push

| Item | Needed |
|---|---|
| Subscription storage | Web Push needs `endpoint`, `p256dh`, `auth` per browser. New table (or columns) with owner RLS; service-only read. Count against the 20-device limit |
| Registration | New Edge Function or extended `register-device` accepting a `PushSubscription` JSON; validate the endpoint host; `unregister` by endpoint; CORS enabled |
| Transport | VAPID-signed, `aes128gcm`-encrypted POST to the endpoint. New secrets e.g. `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`. Treat 404/410 as invalid subscription |
| Payload | JSON for the service worker: same routing keys plus rendered `title`/`body` (no loc-key mechanism in browsers, so always server-rendered using `notificationLanguage`) |
| Privacy | Keep the generic text for private categories; browsers always display something, so there is no silent push. Skip the background refresh channel |
| Gating | `device_gate` reads `device_tokens`; web rows must participate, with an audience mapping |
| Client | Service worker, permission prompt on a user gesture, click handler mapping `category` to routes, `acknowledge_account_notifications` on click. iOS Safari requires an installed PWA |
| Fallback without push | The in-app inbox (`get_account_notifications`) works on the web today with no backend change |

---

## 11. Platform coupling (Apple-specific assumptions)

| Area | Coupling | Second platform needs |
|---|---|---|
| Push transport | APNs only; secrets `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, `APNS_ENVIRONMENT` | 10.6 / 10.7 |
| Device schema | `apns_token` format, `app_bundle_id = 'ao.invest.iosapp'`, `environment` | Migration |
| Rollout audience | from APNs environment | Mapping or new column |
| Billing | `store === "app_store"`, four Apple product ids | Parser change (12.2) |
| Sign-in | Apple native ID token; redirect schemes `investao://`, `investao-dev://` | Services ID first in the Apple provider's client ids; Google provider; web/Android redirect URLs |
| Account deletion | Apple revocation required for any Apple-linked account; native endpoint tied to the bundle id | Path C; one native return URL per deployment |
| Sign-up hook | provider `email` blocked | Web cannot offer email/password or magic-link sign-up |
| Feature config | `minimum_app_build` must be 0 server-side for pushes; "beta" audience means StoreKit sandbox on iOS | Define Android/web audience detection |
| Copy catalogue | `product_voice/catalogue.v1.json` synced with an iOS file | Add Android/web copies to the sync script if they render voice locally |
| Client tolerances | snapshot timestamps without fractional seconds "for the iOS ISO-8601 parser"; display-volume conversion mirrors Swift | None, but do not assume fractional seconds elsewhere are absent |
| Docs | `docs/production-contracts.md`: "Android readiness is deferred" | |

---

## 12. Gap analysis — sign-in and payments

### 12.1 Sign-in

| Need | Android | Web |
|---|---|---|
| Google | Credential Manager ID token -> `signInWithIdToken(provider: google)`; Android client id added to the Google provider | `signInWithOAuth(google)` with PKCE, or Google Identity Services ID token |
| Apple | `signInWithOAuth(apple)` in a Custom Tab; Services ID must be listed first in the provider's client ids (`docs/apple-account-deletion.md`); must resolve to the same user as iOS | Same OAuth flow |
| Redirect allow-list | add the Android app link or scheme | add the site origin(s), e.g. `https://invest.ao/auth/callback` (exact path is a client decision) |
| Session | supabase-kt, refresh token in encrypted storage | `@supabase/ssr` cookies if server-rendered; the website server needs the user JWT anyway for the Apple deletion proxy |
| Email sign-up | blocked by hook | blocked by hook |
| Deletion | Apple-linked: path C native return (shares `investao://` scheme) | Apple-linked: path C `web` with server-side receipt verification; others: `delete_user_account` |
| Backend change | dashboard only | dashboard only, plus CORS on Edge Functions the browser calls directly (`register-device`, `unregister-device`, `sync-subscription`, `apple-web-deletion/start`, `market-snapshot`) — none set CORS headers today |

All are hosted-dashboard changes plus the CORS code change; none can be verified from the repo.

### 12.2 Payments

| Item | Google Play Billing (Android) | Web payments |
|---|---|---|
| Store products | Create Play subscriptions and map them in RevenueCat to entitlements `plus` and `pro` | RevenueCat Web Billing or a Stripe integration feeding the same entitlements |
| App user id | Configure the RevenueCat SDK with the Supabase user UUID | Same id at checkout |
| Server parser | `_shared/subscriptions.ts` rejects `store !== "app_store"` and unknown product ids. Add `play_store` and the Play product ids to the allow-lists | Add `stripe` / `rc_billing` and the web product ids |
| Tier mapping | by product id lists | same |
| Sandbox flag | `is_sandbox` from RevenueCat works unchanged (Play test purchases) | Stripe test mode maps to `is_sandbox` (UNVERIFIED) |
| Family sharing field | Apple-only, optional | n/a |
| Webhook | unchanged; store-agnostic | unchanged |
| Client flow | purchase -> `sync-subscription` -> `get_subscription_access` | checkout return -> `sync-subscription` (needs CORS) -> `get_subscription_access` |
| Management links | Play subscription settings | Customer portal URL from the web billing provider |
| Cross-platform | One entitlement row per user and environment; a later snapshot from any store overwrites it. Two concurrent subscriptions on different stores are not modelled | same |
| Store policy | Play requires Play Billing for in-app digital goods | Apple/Google rules limit linking to web checkout from the apps |
| Paywall copy | prices come from the store SDK, not the backend | prices from the web provider |

No migration is required for either; the change is in `_shared/subscriptions.ts` plus RevenueCat configuration. Until then a Play or web purchase returns `502 BILLING_RESPONSE_INVALID` and grants nothing.

---

## 13. Constraints a client must respect

| Topic | Rule |
|---|---|
| Market reads | Prefer `market-snapshot`; fall back to direct reads; never recompute per screen |
| Freshness | Server decides validity. Show a price as current only inside `validUntilEpoch`; otherwise show the dated verified close (`closes`) or the reference price, labelled with its date. Never label anything "live"/real-time |
| Polling | Respect `control.min_poll_seconds` (migration default 30, allowed 5..3600; live value UNVERIFIED), `Cache-Control max-age`, and `Retry-After`. Use Realtime as a hint only |
| Timeouts | Assume 3 s for signed-out and 8 s for signed-in database calls. Avoid unbounded selects; always filter by `security_id` or date |
| Pagination | 1000-row REST cap. Ledger: 500-row keyset with revision. Inbox: keyset, max 100. Unusual activity: max 200 |
| Rate limits | `sync-subscription` 5/min/account; `admin-refresh-market` 1 per 5 min. No other application-level rate limits found |
| Time | Market timezone `Africa/Luanda` (UTC+1). Trading day, week start (Monday 00:00), quiet hours and "today" are all Luanda-based. Do not derive session state from the device clock alone; use the calendar |
| Hours | 09:25-15:00 Mon-Fri plus calendar overrides. Status can be `unknown`; treat as "do not show current prices" |
| Currency | AOA. Only AOA instruments can enter the portfolio. Bond prices are percent of nominal |
| Precision | Prices numeric(24,8), percentages numeric(16,8), volumes numeric(24,2). Use decimal types. Evidence RPCs return prices as strings; most others as JSON numbers |
| Ids | Securities, issuers, articles, events: uuid. Symbols are display/lookup keys, not ids. ISIN optional. Referral code 8 chars `A-HJ-NP-Z2-9`. Share token 32 url-safe chars. Wrap period key `weekly-YYYY-MM-DD` (Monday) |
| Server text | Notification copy pt and en; inbox copy and articles Portuguese only; database error messages English and not localised. Map `P0001` messages and `details.feature` to client strings |
| Optimistic concurrency | `PT409` -> reload and retry. Watchlist reorder requires the exact current membership |
| Offline writes | Ledger ids and `created_at` are client-suppliable and immutable; generate the uuid client-side for idempotent retries (`created_at` must not be in the future) |
| Privacy | Do not put account data in push text, logs or URLs. Share tokens are bearer secrets |
| Old data | History before the one-year window silently disappears for Free under enforcement; charts must handle short series |

---

## 14. Document summaries

| Document | Summary |
|---|---|
| `docs/production-contracts.md` | Inventory of active contracts: Supabase stack; evidence-carrying ingestion RPCs; `get_portfolio_ledger_page` (500-row cursor tied to a revision); direct `portfolio_transactions` writes under RLS; account notification platform; explicit alerts with frozen evidence; legacy optional notifications retired by a one-way latch; APNs at-least-once; `delete_user_account` for non-Apple; public `health` vs private `intelligence-health`. States "Android readiness is deferred". Keep migrations immutable, fix forward |
| `docs/portfolio-ledger-contract.md` + `contracts/portfolio-ledger.v1.json` | Ledger fields, ordering, and the exact buy/sell/income arithmetic (section 5.1). Eight golden cases: weighted average, fees, income net of tax, closed position keeps realized result, bond at percent of par, same-day ordering by `created_at`, oversell invalidates, income never adds quantity. Copy the JSON unchanged into each client's tests. Server-side portfolio notifications skip accounts holding bonds |
| `docs/notification-platform.md` | Rollout record of the account platform: control starts off; shadow then live; went live at 100% with public previews on 30 Sep 2026. Editorial pushes use article title and summary (100/250 code points). Retention 28 days. Weekly Wrap notification rules. Catalogue sync with iOS |
| `docs/intraday-charts.md` | `sync-intraday` runs each minute in session and 10 min after; per-instrument leases; traded names due every 3 min. `get_intraday_chart` returns the current or most recent session with `status` and `source`; observation fallback has null OHLC/volume. Do not treat last-trade age as an outage signal |
| `docs/BACKEND_ARCHITECTURE.md` | Cron -> ingest -> lease -> BODIVA fetch/parse -> one transactional RPC -> tables -> notifications -> APNs. Idempotent by source hash. Thin Edge handlers; all schema in migrations; service role only in Edge Functions |
| `docs/market-snapshot-cache.md` | Section 9.1. Rationale: per-user recomputation exceeded the statement budget; one shared computation per TTL. Next steps name Android and the website as consumers of the same endpoint |
| `docs/subscriptions.md` | Sections 7 and 12.2. Enforcement off by default; gifts; referral rules; sign-up hook |
| `docs/DATABASE_SCHEMA.md` | Stale. It omits most tables (portfolio, news, recaps, account notifications, groups, subscriptions), says `market_overview` uses a 09:00-15:30 window, describes `notification_deliveries` as the user-visible history, and lists `market_price_changes` as active. Trust this contract and the migrations |

---

## 15. Environments and local development

| Step | Command |
|---|---|
| Requirements | Supabase CLI (CI pins 2.120.0), Deno 2, Docker runtime, Node >= 22 for npm aliases |
| Env file | copy `.env.example` to `.env.local` |
| Start | `supabase start` (API 54321, DB 54322, Studio 54323, Inbucket 54324; Postgres 17) |
| Schema | `supabase db reset` (replays migrations, runs `supabase/seed.sql`) |
| Functions | `supabase functions serve --env-file .env.local` |
| Tests | `deno task test:unit`, `deno task test:edge`, `deno task test:db` (pgTAP files in `supabase/tests` run inside the local DB container), `deno task test` for everything |

Seed (`supabase/seed.sql`): one issuer `sample-issuer` and one **inactive** security `SAMPLE`. There are no quotes, history, calendar verification beyond what migrations insert, no feature configuration row, and no users. A client pointed at a fresh local stack sees an empty market; `market-snapshot` returns empty `prices`. Useful fixtures must be created by hand or borrowed from the pgTAP files (`supabase/tests/*.sql`, which insert inside rolled-back transactions) and `tests/fixtures/unusual_activity.ts`. Local Auth has no Apple/Google provider configured and the sign-up hook blocks email sign-up; create test users with the service role admin API.

Env var names (`.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `BODIVA_AUTOMATION_ENABLED`, `BODIVA_ENABLED_DATASETS`, `BODIVA_MARKET_SUMMARY_EXPORT_URL`, `BODIVA_ORDER_BOOK_EXPORT_URL`, `BODIVA_QUOTE_EVOLUTION_EXPORT_URL`, `BODIVA_RATES_EXPORT_URL`, `BODIVA_AVERAGE_PRICE_EXPORT_URL`, `MARKET_DATA_ALERT_WEBHOOK_URL`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, `APNS_ENVIRONMENT`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_WEB_CLIENT_ID`, `APPLE_WEB_CLIENT_SECRET`, `APPLE_WEB_CALLBACK_URL`, `APPLE_WEB_RETURN_URL`, `APPLE_WEBSITE_RETURN_URL`, `APPLE_WEBSITE_RECEIPT_SECRET`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, `HEALTH_ENDPOINT`, `HEALTH_CRON_SECRET`. Vault secrets used by cron: `project_url`, `cron_secret`. A client needs only the project URL and the publishable (anon) key.

CI (`.github/workflows`): `verify.yml` on push and PR runs migration-version check, lint, format, typecheck, unit and edge tests, three PGlite scripts, then replays migrations on an empty local database and runs pgTAP. `private-health.yml` polls `intelligence-health` every 5 minutes when `HEALTH_MONITOR_ENABLED` is true. Docs note CI has been blocked by account billing at times. Deployment is manual (`supabase db push`, `supabase functions deploy`); no deploy workflow is in the repo. No staging project is defined in the repo; `docs/subscriptions.md` recommends a separate staging backend for sandbox purchases.

---

## 16. Open items (UNVERIFIED, confirm against the live project)

1. Hosted auth providers, client ids, redirect allow-list, JWT expiry.
2. Current `anon`/`authenticated` statement timeouts.
3. `subscription_private.control`: `enforcement_enabled`, `environment`, `lifetime_gifts_enabled`, `referrals_enabled`.
4. `notification_private.control` mode and rollout; current feature configuration row and its expiry.
5. `market_cache_private.client_control` values.
6. Effective table grants for pre-September objects (e.g. whether `authenticated` can update `user_profiles.is_admin`; nothing reads it, but confirm).
7. Realtime project settings (public channels allowed).
8. Which Edge Function versions are deployed, and whether the platform adds CORS headers.
9. How iOS sets `daily_close_capable`.
10. Whether a `user_profiles` row is ever created.
