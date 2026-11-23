# Account features

Every signed-in page is wrapped by `AppShell` (`src/features/shell/app-shell.tsx`), which provides, per tab: the market store, the account stores (`AccountProvider`), privacy mode, the intelligence coordinator and the command palette.

## Account stores

Created once per signed-in tab in `src/features/account/account-provider.tsx`:

| Store | File | Behaviour |
|---|---|---|
| Access | `account-provider.tsx` (`AccessStore`) | The plan document; re-read 400 ms after a burst of confirmed watchlist changes |
| Watchlist | `src/features/watchlist/watchlist-store.ts` | Optimistic changes saved one at a time in order; a failure rolls back with one retryable toast |
| Alerts | `src/features/alerts/alerts-store.ts` | Same pattern |
| Activity | `src/features/activity/activity-store.ts` | Re-read every 60 s while the tab is visible |
| Preferences | `src/features/activity/preferences-store.ts` | Each switch applies at once; a failure restores the last saved state |
| Portfolio | `src/features/portfolio/portfolio-store.ts` | Writes are confirmed by the server before they show |

When the tab becomes visible again, the watchlist and alerts are reloaded. Every result is applied only while the tab still belongs to the account that asked (`readAccountRoute`, `accountWrite`).

Failures are mapped to `AppError` categories and shown by one global presenter as a toast (`src/domain/errors`, `src/features/errors/error-presenter.tsx`).

## Home — `/inicio`

`src/app/[locale]/(app)/inicio/page.tsx`, `src/features/home/home-market.tsx`.

- From the market store: the overview card (market status and index), the watchlist rail, the movement feed, a movers row list and the market updates section.
- From the server: three newest publications, released wrap periods (links to `/wrap/[period]`), a highlighted new admission, the simulator entry.
- The context slot shows the weekly reading's offer or, failing that, the new admission (`src/features/intelligence/home-context-slot.tsx`).
- The market session sheet shows the index with its chart and ranges, or the session's breadth (`src/features/home/market-session-sheet.tsx`).
- The Plus prompt ([plus-and-web-passes.md](../plus-and-web-passes.md)).

## Watchlist — `/lista`

`src/features/watchlist`.

- Rows in saved order with prices from the market store, an alerts button and a row menu. Reordering is by drag on the `Todos` tab or one step at a time from the row menu; it is saved with `reorder_watchlist`. If membership changed elsewhere the list reloads.
- Add dialog: every instrument not yet followed, filtered by search; a press adds at once.
- Remove returns the deleted row so undo re-inserts exactly it (`removeFromWatchlist`, `restoreToWatchlist` in `actions.ts`).
- Groups (Plus): create, rename (1 to 40 characters), delete, add or remove a member.
- Free plan selection: see [plus-and-web-passes.md](../plus-and-web-passes.md).
- "Leitura da semana" at the bottom: at most two observations ([intelligence.md](intelligence.md)).

## Alerts

`src/features/alerts/alerts-dialog.tsx`, `src/domain/account/alerts.ts`.

- Rule kinds: `price_above`, `price_below`, `percent_change_above`, `percent_change_below`, `high_52w`, `low_52w`, `volume_above_average`, `days_without_trades`. The 52-week kinds have no threshold.
- A rule is created with an id chosen by the browser, so a repeated save creates no second row (`createAlertRule` in `src/features/alerts/actions.ts`).
- Automatic movement alerts per instrument (`watchlist_items.automatic_alerts_enabled`) with a sensitivity of `low`, `normal` or `high` (`user_movement_preferences`).
- The web delivers nothing itself. Alert events appear in `/atividade`.

## Activity — `/atividade`

`src/features/activity`, `src/domain/activity`.

- Two tabs (movements, news); day sections newest first; categories `news`, `movements`, `portfolio`, `watchlist`.
- Pages of 50 from `get_account_notifications`. The first page also carries alert deliveries of the last 28 days from `notification_deliveries` (`src/features/activity/server.ts`).
- Opening the page marks nothing read. Opening a row marks it read (`acknowledge_account_notifications`, at most 100 ids per call; `notification_deliveries.is_read`).
- Rows of the weekly reading are merged in from the browser (`src/features/intelligence/activity-rows.ts`).
- The bell's dot is computed on the server for the first render and then follows the store. New rows while the site is open show one toast without amounts.

## Settings — `/definicoes`

`src/app/[locale]/(app)/definicoes/page.tsx`.

| Group | Contents |
|---|---|
| Account | Link to `/planos`, link to `/definicoes/conta`, sign out |
| Notifications | Category switches (`notification_preferences`), market recap opt-in (`set_market_recap_preference`), movement sensitivity, unusual-activity switches (`src/features/activity/notification-settings.tsx`) |
| Personalisation | Two resets, both local to this browser (`src/features/settings/personalisation-group.tsx`) |
| Appearance | Theme (system, light, dark; cookie `theme`), language |
| App | About, terms, privacy policy, data sources |
| Market data | Source, market state, last update of the loaded snapshot |

`/definicoes/conta` shows the linked sign-in providers, the email and account deletion.

## Account setup

Shown instead of any signed-in page while the token's `investao_onboarding_completed` is `false` (`src/features/shell/signed-in-frame.tsx`).

- Step 1: an optional name, saved to user metadata (`investao_display_name`, `investao_name_skipped`).
- Step 2: the first watchlist.
- Completion writes `investao_onboarding_completed: true` and refreshes the session (`src/features/account-setup/actions.ts`).
- The draft is kept per account in this browser under `investao.accountSetup.<id>.*` and survives sign-out (`src/features/auth/account-state.ts`).
- The step rules are in `src/domain/account-setup/flow.ts`.

## Account deletion

`src/features/settings/delete-account.tsx`, `src/data/account/deletion.ts`, `src/domain/account/deletion-receipt.ts`.

Confirming posts a plain form that names the account. The server first confirms with `auth.getUser()` that the session is still that account.

**Without Apple sign-in** — `POST /api/account/delete`: calls `delete_user_account`, signs out locally, clears cookies, sends `Clear-Site-Data: "cache", "storage"` and redirects to `/entrar?motivo=eliminada`.

**With Apple sign-in** — `POST /api/account/apple-deletion/start`:

1. Requires `APPLE_WEBSITE_RECEIPT_SECRET`; without it the attempt stops.
2. Creates a 32-byte challenge and calls `apple-web-deletion/start` with `{returnPlatform: "web", browserChallenge}`.
3. Accepts the answer only if it names this user, `receiptVersion` 1, and an `https://appleid.apple.com` URL.
4. Stores the attempt (challenge, user, language) in the HttpOnly cookie `investao-apple-deletion` (path `/api/account/apple-deletion`, 300 seconds) and redirects to Apple.

`GET /api/account/apple-deletion/complete?receipt=…` verifies the signed receipt against the attempt cookie, consumes the cookie, and acts on the outcome: `deleted` clears the session only after `auth.getUser()` agrees the account is gone; `cancelled` and failures return to `/definicoes/conta?eliminacao=…` with the person still signed in.

Result values shown on the account page: `cancelled`, `retry`, `connection`, `signIn`, `changed`.

`/eliminar-conta` is the public page that explains deletion and links to sign-in.

## Privacy mode

`src/domain/privacy/privacy.ts`, `src/features/privacy`.

- A per-browser preference in the cookie `investao-privacy` (value `on`, one year), so the server renders personal values already hidden.
- Hidden values are replaced by `••••••`; the real value is not in the page (`Private` in `src/features/portfolio/portfolio-ui.tsx`).
- While hidden, rows that could reveal position size by their order sort by instrument id (`orderWhileHidden`).
- It stops personalisation capture and hides the portfolio tiles of the weekly reading.
- It is kept across sign-out.

## Sign-out and session expiry

`clearAccountState()` resets the market store, removes `localStorage` and `sessionStorage` keys with the prefixes `investao.account.` and `investao.productVoice.`, and deletes the intelligence IndexedDB database (`src/features/auth/account-state.ts`).

## Tests

`tests/e2e/home.spec.ts`, `watchlist.spec.ts`, `activity.spec.ts`, `settings.spec.ts`, `auth.spec.ts`; `tests/e2e-local/session.spec.ts`, `deletion.spec.ts`; unit tests beside the stores and in `src/domain/account`, `src/domain/account-setup`, `src/domain/activity`, `src/data/account`.
