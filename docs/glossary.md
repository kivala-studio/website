# Glossary

| Term | Meaning in this codebase |
|---|---|
| BODIVA | Angola's stock exchange; the source of the market data |
| Site | The public pages, served on `SITE_URL` |
| App | The signed-in pages, served on `APP_URL` when set |
| Proxy | `src/proxy.ts`, the Next.js request proxy |
| Data mode | `demo`, `local` or `production` (`NEXT_PUBLIC_DATA_MODE`) |
| Snapshot | The shared market document from the `market-snapshot` Edge Function, read through `/api/market/snapshot` |
| Market store | The tab's single owner of market state (`src/data/market/store.ts`) |
| Catalogue | The cached public list of instruments with their verified closes (`getPublicCatalogue`) |
| Verified close | A dated closing price from `latest_verified_market_closes`; the only price server-rendered HTML shows |
| Current quote | A price the quote policy accepts as usable now; added in the browser only |
| Reference price | A BODIVA reference price shown when there is no session quote |
| Data quality | A status and reasons attached to a value (`src/domain/market/quality.ts`) |
| Pulse / Indicador invest.ao | The market index from `quality_market_pulse_history`; labelled as calculated, not official |
| Instrument, security | A listed share, bond, fund or treasury security |
| Ledger | The account's list of buy, sell and income records |
| Book, named portfolio | A row of `portfolios`; `null` is the main portfolio; `combined` is the view over all |
| Access | The plan document from `get_subscription_access()` |
| Enforcement | `enforcement_enabled`: whether the server applies Free limits to the account |
| Plus | The only paid plan |
| Web pass | Prepaid Plus for a number of months, paid in kwanzas, not renewed |
| Order | One web pass purchase (`pending`, `paid`, `expired`, `failed`, `refunded`, `cancelled`) |
| Express | Payment method `mcx_express`: a push to a mobile number |
| Reference | Payment method `reference`: an entity and a reference number to pay elsewhere |
| NIF | Taxpayer number, optional at checkout |
| Upgrade reason | Why a Plus dialog opened (`UpgradeReason`, `src/domain/errors/rules.ts`) |
| Server rule | A `P0001` business error from PostgREST with a known message |
| Weekly reading, intelligence | Verified observations computed in the browser ([features/intelligence.md](features/intelligence.md)) |
| Feature controls | The `intelligence_feature_configuration` document |
| Wrap | A released weekly, monthly or yearly recap period (`get_available_market_wraps`) |
| Week ahead | Announced dated events of the next civil week |
| Unusual activity | Per-session signals from `get_unusual_activity` |
| Market information, update | Notices carried in the snapshot (`MarketUpdate`) |
| Privacy mode | The per-browser setting that hides personal values |
| Account setup | The name and first-watchlist steps after a first sign-in |
| Stage | A full-bleed fill with its on-colour (`stage-brand`, `stage-deep`, `stage-ink`, `stage-pale`) |
| Panel | The flat card surface (`panel` utility) |
| `desk` | The Tailwind variant for screens at least 1024 px wide with a fine pointer |
| Store-linked pages | Pages the iOS app or the store listings link to; they leave Plus out of their chrome |
| Luanda day, civil date | A calendar day in `Africa/Luanda`, as `YYYY-MM-DD` |
