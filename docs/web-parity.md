# Web / iOS parity inventory

This is an implementation and verification inventory, not a claim that all iOS behaviour is already reproduced.

## Shared product foundation

- Same Supabase project, Auth identities, `investao_display_name` / onboarding metadata, watchlist, alert rules, portfolio ledger, notification preferences and activity records.
- iOS light/dark semantic colours and system appearance; native Rounded icon paths; 12/18/24-point corner hierarchy. System typography uses the native platform stack.
- Persistent desktop sidebar and the same five primary tabs on mobile: Início, Explorar, Carteira, Lista, Pesquisa.
- Financial privacy applies immediately to holdings, portfolio charts, activity previews and personal recap pages/exports. Privacy and appearance persist locally. Account changes unmount private views.
- Public browsing leads directly into account features; internal links no longer use repeated external-link arrows or iOS-install prompts.

## Implemented

| iOS capability                                  | Web surface                       | Notes                                                                                                                                                                        |
| ----------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home, market overview and proprietary indicator | `/dashboard`                      | Interactive equity chart, verified indicator, account counts, editorial feed; `/` is the public landing page                                                                 |
| Instrument discovery/search                     | `/mercado`, `/pesquisa`           | Category filters, sorting, issuer/name/symbol/ISIN lookup                                                                                                                    |
| Instrument detail                               | `/mercado/[id]`                   | Daily/intraday history, issuer context, order book, reports, dividends, related articles, share                                                                              |
| Comparison and chart export                     | `/comparar`                       | Common observation dates, rebased percentage changes, accessible table and SVG export                                                                                        |
| Google/Apple sign-in, profile, onboarding       | Landing modal, `/conta`, `/auth/callback` | Same identities and metadata; workspace requires login; preserves the requested route/query; `/conta` holds signed-in profile settings                                   |
| Watchlist                                       | `/lista`                          | Add, remove/undo, reorder, per-instrument automatic alerts                                                                                                                   |
| Price/movement alerts                           | `/alertas`                        | Create, edit, pause, delete; correct bond percentage units                                                                                                                   |
| Manual portfolio                                | `/carteira`, `/carteira/[id]`     | Buy/sell/edit/delete, weighted cost, realised/unrealised values, allocation, exact-day historical coverage                                                                   |
| Simulator                                       | `/simular`                        | General or eligible AOA equity/fund scenario, monthly contributions, whole/fractional units and uninvested cash                                                              |
| News/article/source reading                     | `/noticias`, `/noticias/[slug]`   | Published-only queries, related instruments, native share/copy                                                                                                               |
| Activity centre                                 | `/actividade`, `/actividade/[id]` | Account records plus deduplicated legacy alerts/recaps; read state, filters, safe previews and validated frozen portfolio details                                            |
| Calendar and new admissions                     | `/agenda`                         | Verified BODIVA sessions, issuer dividend dates, sourced listing announcements, personal issuer-event filter                                                                 |
| Weekly/monthly summaries                        | `/resumos`                        | Authenticated evidence contract; market/watchlist/eligible no-flow portfolio stories, native soundtrack, page export, immutable editions, resume history and underlying data |
| Profile/preferences/privacy/account deletion    | `/conta`                          | Shared notification preferences; non-Apple deletion RPC; Apple browser flow requires backend platform-return deployment                                                      |

## Personalisation and notification detail

- Daily discovery aggregates use the same `user_activity_daily` contract as iOS. Views are deduplicated for 30 minutes; each action is capped at three signals per asset/day across installations, with a 28-day half-life, 112-day retention and an eight-point behavioral ceiling. Holdings/list/alerts retain the native 80/40/20 priority.
- Web Locks serialize cumulative counters across tabs. Pending writes are persisted locally and replayed idempotently; they stop on account changes or privacy mode. Search strings and financial amounts never enter this stream. Capture requires a secure browser context with Web Locks and local storage; unavailable storage cannot block primary features.
- Instrument detail, search result selections, comparison selections, chart ranges, watchlist changes and recap opens contribute to the shared counters. The market can be sorted by these interests and the agenda has an issuer-event personal view.
- Resetting interests applies to this browser, keeps explicit holdings/list/alerts, and resumes behavioral ranking tomorrow, matching iOS daily aggregate semantics. It does not erase shared activity or reset the other device.
- Portfolio notification detail calls the owner-scoped frozen-evidence RPC. It validates versions, dates, expiry, source identifiers, positive quantities/prices, position contributions and reconciled totals. It shows original values and dates, never today's holdings substituted into an earlier event. Privacy hides amounts, positions and provenance. Missing/withdrawn/expired evidence has no financial fallback.

## Recap editions and playback

- The first verified composition is saved atomically in account-scoped IndexedDB, including original catalogue, evidence, holdings inputs, watchlist membership and rendered story content. Later market/portfolio changes cannot overwrite it. Historical playback revalidates the saved evidence at its capture time and checks the stored financial presentation against that evidence.
- Weekly editions are retained for 730 days from first creation; monthly editions for 56 days. Saved periods remain accessible when the current release list is empty or unavailable. Unsupported or damaged history is an explicit error, never a cache miss that authorizes regeneration.
- “Recriar personalização” obtains fresh evidence and current watchlist membership, requires every watched instrument to have complete coverage, and appends an edition. Original market and portfolio stories remain unchanged. Optimistic revision checks prevent a second tab from overwriting a newer edition. Users can switch back to the original.
- Correction-domain support requires an explicit source revision, explanation, reason and predecessor. Corrections cannot change captured holdings/watchlist membership. There is no automatic inference of a financial correction from changed live data, and no production correction-receipt feed has been connected.
- Resume position and completion are per edition. Availability/completion are idempotent; rebuilds start fresh. Weekly lifecycle events use the same daily aggregate contract as iOS and respect privacy capture. Closing-tab abandonment writes are best effort under browser lifecycle constraints.
- Confirmed deletion removes that account's local archive and blocks in-flight writes from recreating it. Apple completion now requires a signed, short-lived receipt bound to the initiating browser; cancelled and failed returns preserve local data. Shared cleanup checks the current session owner and removes only the deleted owner's archives and local discovery aggregates. Live Apple verification is still pending.
- A temporary development-only page with fictional values verified player navigation and privacy masking, then was removed. It was not an authenticated account test or a deployed route.

## Verification performed

- Production build, TypeScript and ESLint.
- Five focused Apple receipt/cleanup checks: HMAC contract, browser ownership, tampering, expiry, authenticated outcomes and preserving another account already active on return.
- Focused finance, quotation and recap-contract tests, six notification-evidence/personalisation checks, and eight recap archive/storage checks. The latest update ran 14 checks covering the affected recap, storage and personalisation contracts, including concurrent IndexedDB writes using fake-indexeddb.
- Production dependency audit.
- Live anonymous API checks and ownership rejection for private tables.
- Browser checks: public homepage, comparison data and range switching, exact zero-growth simulation, agenda rendering, signed-out notification-detail gate with preserved return path, and account entry screen.

- Apple return checks: the invalid-receipt route redirects without setting cookies, the result endpoint rejects missing receipts, and an unsigned `status=deleted` URL leaves the normal account screen. No real account was deleted.

## Still required for complete parity / release

- Signed-in browser verification of existing-user data, account switching, preferences and CRUD. The implementation uses deployed contracts but a user session has not yet been supplied for this check. Use a designated disposable account for write/delete checks, never real investment records.
- Background browser push delivery. Activity and preference management are present, but there is no Web Push subscription/transport yet; the existing delivery service is APNs-only.
- Usefulness feedback, exposure-aware selection and home/watchlist/portfolio insight families were added in the 18 October checkpoint. They still require signed-in verification; the old inventory's claim that they were entirely absent was stale. Additional recap story families/ranking and the authoritative correction-receipt feed remain unfinished.
- Calendar personalisation currently covers issuer dividend events; personalised week-ahead editorial selection and Saturday discovery remain outstanding.
- Comparison currently supports two instruments. Adding more than two to the same chart remains unfinished.
- iOS-only OS surfaces (widgets, Shortcuts/App Intents, haptics and native notification settings) need explicit browser equivalents or a documented platform exception.
- Verify production OAuth allowlisting and deploy the Apple web return backend dependency before enabling the deletion path. No production configuration or database changes were applied by this work.

The 20 October [dashboard audit](dashboard-feature-audit.md) maps confirmed gaps to shared “Em desenvolvimento · Em breve” UI states beside their relevant features. There is no separate dashboard list. Working features with missing data or pending live verification keep their existing states.

## Apple deletion deployment dependency

Backend PR 73 adds the platform and browser-challenge migrations and signs web outcomes.
Deploy both migrations before the function, configure its `APPLE_WEBSITE_RETURN_URL`
as `https://invest.ao/api/account/apple-deletion/complete`, and set the same server-only
`APPLE_WEBSITE_RECEIPT_SECRET` in both deployments (32 random bytes, 64 hex characters).
The website requires the verified user/receipt version from `/start` and uses HttpOnly,
Secure, SameSite=Lax host cookies; serve over HTTPS. Missing configuration fails closed.
Ordinary status query parameters never authorize cleanup. The callback consumes its
browser binding, and acknowledgement consumes the result cookie. No secret, deployment
or real account deletion was performed. Real Apple authorization and concurrent account
switching still need a designated non-production disposable account.

Apple deletion now also requires `APPLE_WEB_DELETION_ENABLED=true` on the website,
in addition to a valid receipt secret. Leave it false until the dependency and
designated-account checks are complete. The start route fails closed while disabled;
Apple users see the development state instead of a confirmation form. Non-Apple
deletion and previously initiated receipt returns are unchanged.

## Financial boundaries

Display references cannot become valuation inputs. Verified last-session quotes can be used while the market is closed, only until the quality deadline. Portfolio history excludes a date if any open position lacks an exact-day mark; it does not carry prices forward. Portfolio value changes include trade flows and are not labelled returns. Recap portfolio changes are omitted when the comparison interval includes ledger operations or lacks full eligible coverage. Bond price changes are not yields. No screen executes market orders.
