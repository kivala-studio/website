# Web / iOS parity inventory

This is an implementation and verification inventory, not a claim that all iOS behaviour is already reproduced.

## Shared product foundation

- Same Supabase project, Auth identities, `investao_display_name` / onboarding metadata, watchlist, alert rules, portfolio ledger, notification preferences and activity records.
- iOS light/dark semantic colours and system appearance; native Rounded icon paths; 12/18/24-point corner hierarchy. System typography uses the native platform stack.
- Persistent desktop sidebar and the same five primary tabs on mobile: Início, Explorar, Carteira, Lista, Pesquisa.
- Financial privacy applies immediately to holdings, portfolio charts, activity previews and personal recap pages/exports. Privacy and appearance persist locally. Account changes unmount private views.
- Public browsing leads directly into account features; internal links no longer use repeated external-link arrows or iOS-install prompts.

## Implemented

| iOS capability                                  | Web surface                       | Notes                                                                                                                                 |
| ----------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Home, market overview and proprietary indicator | `/`                               | Interactive equity chart, verified indicator, account counts, editorial feed                                                          |
| Instrument discovery/search                     | `/mercado`, `/pesquisa`           | Category filters, sorting, issuer/name/symbol/ISIN lookup                                                                             |
| Instrument detail                               | `/mercado/[id]`                   | Daily/intraday history, issuer context, order book, reports, dividends, related articles, share                                       |
| Comparison and chart export                     | `/comparar`                       | Common observation dates, rebased percentage changes, accessible table and SVG export                                                 |
| Google/Apple sign-in, profile, onboarding       | `/conta`, `/auth/callback`        | Same identities and metadata; returns to the requested feature after login; older accounts are not forced through new onboarding      |
| Watchlist                                       | `/lista`                          | Add, remove/undo, reorder, per-instrument automatic alerts                                                                            |
| Price/movement alerts                           | `/alertas`                        | Create, edit, pause, delete; correct bond percentage units                                                                            |
| Manual portfolio                                | `/carteira`, `/carteira/[id]`     | Buy/sell/edit/delete, weighted cost, realised/unrealised values, allocation, exact-day historical coverage                            |
| Simulator                                       | `/simular`                        | General or eligible AOA equity/fund scenario, monthly contributions, whole/fractional units and uninvested cash                       |
| News/article/source reading                     | `/noticias`, `/noticias/[slug]`   | Published-only queries, related instruments, native share/copy                                                                        |
| Activity centre                                 | `/actividade`, `/actividade/[id]` | Account records plus deduplicated legacy alerts/recaps; read state, filters, safe previews and validated frozen portfolio details     |
| Calendar and new admissions                     | `/agenda`                         | Verified BODIVA sessions, issuer dividend dates, sourced listing announcements, personal issuer-event filter                          |
| Weekly/monthly summaries                        | `/resumos`                        | Authenticated evidence contract; market/watchlist/eligible no-flow portfolio stories, native soundtrack, page export, underlying data |
| Profile/preferences/privacy/account deletion    | `/conta`                          | Shared notification preferences; non-Apple deletion RPC; Apple browser flow requires backend platform-return deployment               |

## Personalisation and notification detail

- Daily discovery aggregates use the same `user_activity_daily` contract as iOS. Views are deduplicated for 30 minutes; each action is capped at three signals per asset/day across installations, with a 28-day half-life, 112-day retention and an eight-point behavioral ceiling. Holdings/list/alerts retain the native 80/40/20 priority.
- Web Locks serialize cumulative counters across tabs. Pending writes are persisted locally and replayed idempotently; they stop on account changes or privacy mode. Search strings and financial amounts never enter this stream. Capture requires a secure browser context with Web Locks and local storage; unavailable storage cannot block primary features.
- Instrument detail, search result selections, comparison selections, chart ranges, watchlist changes and recap opens contribute to the shared counters. The market can be sorted by these interests and the agenda has an issuer-event personal view.
- Resetting interests applies to this browser, keeps explicit holdings/list/alerts, and resumes behavioral ranking tomorrow, matching iOS daily aggregate semantics. It does not erase shared activity or reset the other device.
- Portfolio notification detail calls the owner-scoped frozen-evidence RPC. It validates versions, dates, expiry, source identifiers, positive quantities/prices, position contributions and reconciled totals. It shows original values and dates, never today's holdings substituted into an earlier event. Privacy hides amounts, positions and provenance. Missing/withdrawn/expired evidence has no financial fallback.

## Verification performed

- Production build, TypeScript and ESLint.
- Focused finance, quotation and recap-contract tests, plus six checks for frozen notification evidence and personalisation weights, cross-account isolation, decay and reset cutoffs.
- Production dependency audit.
- Live anonymous API checks and ownership rejection for private tables.
- Browser checks: public homepage, comparison data and range switching, exact zero-growth simulation, agenda rendering, signed-out notification-detail gate with preserved return path, and account entry screen.

## Still required for complete parity / release

- Signed-in browser verification of existing-user data, account switching, preferences and CRUD. The implementation uses deployed contracts but a user session has not yet been supplied for this check. Use a designated disposable account for write/delete checks, never real investment records.
- Background browser push delivery. Activity and preference management are present, but there is no Web Push subscription/transport yet; the existing delivery service is APNs-only.
- Native usefulness feedback and exposure-aware content selection, immutable recap editions/correction workflow and lifecycle analytics still need porting. Shared behavioral counters and browser-local interest reset are implemented; current recap stories derive from fresh verified data and current holdings/watchlist.
- Native home/watchlist/portfolio insight generation and ranking still need parity work. Calendar personalisation currently covers issuer dividend events; personalised week-ahead editorial selection remains outstanding.
- iOS-only OS surfaces (widgets, Shortcuts/App Intents, haptics and native notification settings) need explicit browser equivalents or a documented platform exception.
- Verify production OAuth allowlisting and deploy the Apple web return backend dependency before enabling the deletion path. No production configuration or database changes were applied by this work.

## Financial boundaries

Display references cannot become valuation inputs. Verified last-session quotes can be used while the market is closed, only until the quality deadline. Portfolio history excludes a date if any open position lacks an exact-day mark; it does not carry prices forward. Portfolio value changes include trade flows and are not labelled returns. Recap portfolio changes are omitted when the comparison interval includes ledger operations or lacks full eligible coverage. Bond price changes are not yields. No screen executes market orders.
