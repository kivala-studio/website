# Dashboard feature audit — 20 October 2026

Scope: implementation review of every dashboard section, its sidebar destinations and their data/action paths. No signed-in test account was used. Existing private CRUD, account switching and provider flows therefore remain pending live verification; they are not labelled unfinished solely because that verification is pending.

## Confirmed implementation gaps

The shared `lib/web-feature-status.ts` inventory drives the dashboard's “A caminho da web” cards and the inline “Em desenvolvimento · Em breve” states. These are implementation states, independent of loading, errors, missing financial evidence, empty accounts, privacy and cookie consent.

| Feature | What is usable | What is labelled in development | Where shown |
| --- | --- | --- | --- |
| Browser notifications | Alert CRUD, shared app preferences, in-site Activity | Background Web Push: no subscription, service worker or browser transport exists | Dashboard, Alertas, Actividade, account notification settings |
| Personalised week ahead | Verified market sessions, published issuer dates and personal dividend-event filter | Personalised editorial selection of the coming week; the control name exists but no renderer/selection path implements it | Dashboard, Agenda |
| Saturday discovery | News and existing verified observation cards | Saturday-specific discovery selection; the control name exists without a feature implementation | Dashboard |
| Richer summaries | Basic market breadth/movers, watchlist and eligible portfolio stories, immutable archives, playback and export | Additional native story families and selection; authoritative correction-receipt feed is not connected | Dashboard, Resumos |
| Multi-instrument comparison | Two selected instruments, common dates, periods and export | More than two instruments; current state and chart load are fixed to a pair | Dashboard, Comparar |
| Apple account deletion on web | Existing signed receipt/callback implementation; non-Apple deletion remains available | Apple browser flow requires deployed backend and explicit verification before release | Dashboard and Apple users' account deletion section, while unavailable |

Apple deletion is unavailable by default. The server must have both `APPLE_WEB_DELETION_ENABLED=true` and a valid server-only receipt secret before the UI offers it or the start route forwards a request. Set that flag only after the backend deployment and designated-account checks described in `web-parity.md`. Receipt verification/cleanup routes remain available for an already initiated return. This audit did not deploy anything or delete an account.

## Other reviewed surfaces

| Surface | Code path reviewed | Classification |
| --- | --- | --- |
| Dashboard market/chart | MarketSpotlight, MarketExplorer, HistoryChart, MarketPulse and verified quote/history contracts | Implemented; unavailable or expired financial data retains its data state |
| Dashboard account counts | HomeAccount, owner-scoped ledger/watchlist | Implemented; private live verification pending |
| Existing insight cards | Verified financial/publication families, ranking and operational controls, local feedback | Implemented checkpoint; signed-in review pending, no blanket coming-soon replacement |
| Market/search/instrument detail | Filters/search, issuer lookup, history/intraday RPC, book/reports/dividends, articles/share, watch/alert actions | Implemented paths; missing source data is not a development state |
| Watchlist | Add/remove/undo, reorder RPC, automatic-alert preferences | Implemented; private writes not exercised |
| Manual portfolio | Ledger pagination, validated buy/sell/edit/remove, valuation/allocation and exact-day history | Implemented; private writes not exercised; incomplete coverage remains a financial-data state |
| Simulator | General and eligible equity/fund scenarios, inputs, reset, decimal calculation and chart | Implemented; supported scope explicitly described |
| News | Published-only listing, source links, article and search | Implemented |
| Account access/profile | Google/Apple modal, onboarding, return path, profile updates and sign-out | Implemented; live provider/account-switch verification pending |
| Appearance/privacy/consent | Theme preference, open/closed padlock, masking, optional-storage consent gate | Implemented; consent-off is a preference rather than a development failure |
| Native OS surfaces | iOS widgets, App Intents/Shortcuts, haptics and system notification settings | Native platform surfaces with no corresponding web controls; no invented web release promise |

## Verification of this change

- Production build/TypeScript and focused lint on changed files.
- Isolated render checks of all registry states, existing destination links, and the Apple release/configuration guard.
- Desktop/mobile browser inspection of the actual shared status component in a temporary isolated preview, without bypassing dashboard authentication or using private account data.
- No broad test suite, real financial writes, account deletion, backend migration or production configuration change.
