# Live facts

Open facts from `docs/plan/README.md`, checked on 2026-11-10 against the hosted project with the publishable key only, and against the backend at `origin/main` `c12bb12`. Anything that needs the dashboard, the service role or a service-only table is marked **owner to confirm**.

| Fact | Status | Value | How |
|---|---|---|---|
| Auth: enabled providers | Confirmed | Apple, Google, Email. `disable_signup` is false; passkeys, SAML and phone are off | `GET /auth/v1/settings` |
| Auth: client ids, redirect allow-list, JWT expiry | Owner to confirm | Not exposed publicly. WB1 needs the redirect allow-list to include the web callback URLs | Dashboard → Authentication |
| Email sign-up | Confirmed (code) | Email is enabled on the Auth API, but `public.hook_before_user_created` rejects email sign-ups. The web offers Apple and Google only | Backend migrations |
| `subscription_private.control`: enforcement, referrals, gifts | Owner to confirm | Service-only. `get_subscription_access` cannot be called signed out (`42501`), so it can only be read with a session | `POST /rest/v1/rpc/get_subscription_access` as anon |
| Role statement timeouts | Owner to confirm | Not in migrations. Last recorded: 3 s for anon, 8 s for authenticated | Dashboard → Database → Roles |
| Realtime `market:prices` topic | Confirmed | **Private.** Clients may receive but never send. iOS joins it as private (invest.ao #303), so the disagreement in the README is resolved | Migration `20261112260000_private_market_broadcast.sql` |
| `intelligence_feature_configuration` | Confirmed | Version 9, updated 2026-11-09 00:15 UTC, **expires 2026-11-16 00:15 UTC**. Off: `week_ahead`, `saturday_discover`, `personalization_v2`; everything else on | `GET /rest/v1/intelligence_feature_configuration` (anon may read it) |
| `market_cache_private.client_control` | Confirmed | `maintenance: false`, `min_poll_seconds: 30`; reaches clients as `control` in the snapshot | `GET /functions/v1/market-snapshot` (contract version 1) |
| Snapshot caching | Confirmed | `cache-control: public, max-age=118, stale-while-revalidate=5`, weak `ETag` | Same request |
| CORS on Edge Functions | Confirmed | None on `market-snapshot`: `OPTIONS` returns 405 and `GET` has no `access-control-*` headers. In code, only `capture-recap-evidence` uses `_shared/cors.ts`. That fits rule 6: the website calls Edge Functions only from route handlers | `OPTIONS` and `GET` with `Origin: https://invest.ao` |
