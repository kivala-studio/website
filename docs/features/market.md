# Market features

## Price rules

These rules are implemented in `src/domain/market` and apply to every screen.

- A data-quality report has a status (`valid`, `incomplete`, `stale`, `delayed`, `invalid`, `unknown`) and reasons. A value is usable for insight only when the status is `valid` with no reasons (`permitsInsight`, `src/domain/market/quality.ts`).
- `permitsUse`: additionally, observation times are not in the future and `now` is before `validUntilEpoch`.
- `permitsCurrentUse`: additionally, `validUntilEpoch` exists and is at most 120 seconds after `sourceObservedAtEpoch`.
- The price shown follows this precedence: session quote, BODIVA reference price, verified close, usable quote, last reported price (`displayPrice` in `src/domain/market/quote-policy.ts`).
- Only prices returned by `currentQuotePrices` value a portfolio; everything else is display evidence (`src/domain/market/quote-policy.ts`).
- A list row shows a current price once the store has assessed it as usable, otherwise the dated verified close rendered by the server, otherwise the message `common.priceUnconfirmed` ("Preço por confirmar" / "Price unconfirmed") (`rowFigure` in `src/features/market/browse/price-cell.tsx`).
- Server-rendered HTML contains dated verified closes only. The landing page has no market store and never shows a current quote (`src/features/site/home-client.tsx`).
- Market state and trading days come from the server calendar, evaluated in `Africa/Luanda` (`src/domain/market/calendar.ts`, `src/domain/market/zone.ts`). The calendar requires `contract_version >= 2`.

## Market store

One store per tab (`src/data/market/store.ts`), run by `MarketProvider` (`src/features/market/market-provider.tsx`).

- Source: `/api/market/snapshot`. After a snapshot server failure, direct reads replace it for five minutes (`src/data/market/repository.ts`).
- Automatic refresh interval: 30 s while open or unknown, 60 s while closed or opening soon, 120 s while Realtime announcements flow. The server's `control.min_poll_seconds` is a lower bound (clamped 5 to 3600); `control.maintenance` forces 300 s (`src/domain/market/refresh.ts`).
- Failures: the first keeps the cadence; later ones back off exponentially with full jitter, capped at 300 s, never below the cadence or the server's `retry_after_seconds`. Only the automatic loop retries.
- Hiding the tab suspends polling and revokes current quotes; showing it refreshes. Losing the connection revokes current quotes; reconnecting starts one refresh (`src/data/market/connectivity.ts`).
- Values are downgraded locally at their deadlines without a network call (`nextReassessment`).
- A result is applied only if no suspension or reset happened since its request started. Sign-out resets the store (`resetTabMarketStore`).
- A Realtime `quotes` announcement triggers a reload ([data-layer.md](../data-layer.md)).

## Market list — `/mercado`

`src/app/[locale]/(market)/mercado/(overview)/page.tsx`, `src/features/market/browse`.

- Three cards: market status with the market index ("Indicador invest.ao", from `quality_market_pulse_history`, labelled as calculated and not official), session data, and movers (gains, declines, volume; five rows; only instruments with a usable current quote).
- The browser: category tabs (`acoes`, `obrigacoes`, `fundos`, `tesouro`, `todos`), search and sort. URL parameters: `q`, `categoria`, `ordem` (`variacao`, `preco`, `volume`, `nome`), `sentido` (`asc`, `desc`). Defaults: equities, by change, descending (`src/features/market/browse/query.ts`).
- Filtering and sorting run on the server's catalogue before the store loads, so the list works as links and a GET form without JavaScript (`market-browser.tsx`).
- A signed-in visitor gets links to News and Learn in the tab row.
- A summary row links to market information when the snapshot has updates.

## Instrument page — `/mercado/[symbol]`

`src/app/[locale]/(market)/mercado/[symbol]`, `src/features/market/instrument`.

- The layout resolves the symbol before streaming: another spelling redirects to the canonical symbol, an unknown symbol is a 404 (`load.ts`, `layout.tsx`).
- Server-rendered: identity, the dated verified close, one year of daily closes, issuer, latest dividend, financial reports, bond facts, JSON-LD.
- Added in the browser: current quote and its validity line, status, session statistics.
- Chart ranges: `1D`, `1S`, `1M`, `3M`, `6M`, `1A`, `Tudo` (`src/features/chart/ranges.ts`). The chart draws real observations only; pointer and arrow keys select the nearest one (`src/features/chart/price-chart.tsx`).
- Signed-in only (`account-panels.tsx`):

| Panel | Data | Plan |
|---|---|---|
| `1D` intraday | `/api/account/intraday/[id]`, refreshed every minute while shown | — |
| `Tudo` and history CSV export | `/api/account/history/[id]` | Plus |
| Order book | `/api/account/order-book/[id]`, refreshed every minute while shown | 5 levels a side without Plus |
| Liquidity | Computed from daily history over the last 20 sessions | Plus |
| Star, share, compare, alerts | Watchlist and alert stores | See [account.md](account.md) |

- Comparison: up to three instruments of the same kind as percentage change from their common start. Each set is authorised by `authorize_chart_comparison`; a set without two shared observations is refused in the browser first (`comparison-sheet.tsx`).
- Bond yield calculator: terms typed by the user, saved per symbol in this browser (`bond-yield-dialog.tsx`, `src/domain/market/bond-yield.ts`).

## New admissions — `/mercado/admissao/[event]`

Shows a `market_events` row of kind `new_listing` before its security trades: expected or confirmed date, status, issuer description and official sources. Once confirmed and present in the catalogue, the route redirects to the instrument page (`src/app/[locale]/(market)/mercado/admissao/[event]`). Home shows a highlighted listing as the context slot's fallback (`src/app/[locale]/(app)/inicio/page.tsx`).

## Search

- `/pesquisa` and the command palette share `SearchPanel`: categories with counts, recents, highest volume, results grouped by kind with a watchlist star (`src/features/search/search-panel.tsx`).
- The palette opens with `/` or Ctrl/⌘ K inside the signed-in shell (`src/features/search/command-palette.tsx`). Visitors have no search in the public header (`src/features/site/chrome.tsx`); the landing page has a GET form to `/mercado`.

## News — `/noticias`

- Feed pages of 20 (`NEWS_PAGE_SIZE`, `src/data/news/feed-store.ts`), server-rendered, then refreshed every minute in the browser through `/api/news`. "Load more" and the title search work as links and a GET form without JavaScript (`src/features/news/news-feed.tsx`).
- An article is Markdown rendered by a safe subset: headings, paragraphs, quotes, lists, rules, emphasis and safe links (`src/domain/news/markdown.ts`, `src/features/news/markdown.tsx`). Articles are marked `lang="pt-AO"`.
- The article page lists sources and related instruments with their dated verified close.

## Market information — `/mercado/informacao`

Publications, then updates read from the tab's market snapshot (`MarketUpdate`), with category chips; `/mercado/informacao/[id]` shows one update (`src/features/news/market-information.tsx`). The code states that no live source sends these updates; the demo scenario `updates` supplies them (`src/data/market/demo/scenarios.ts`).

## Unusual activity — `/atividade-invulgar`

- Rows come from `/api/market/unusual-activity` (`get_unusual_activity` as `anon`): the latest session's signals.
- The view groups signals per instrument, followed instruments first and shares before bonds (`src/features/unusual-activity/unusual-activity-view.tsx`, `src/domain/unusual-activity`).
- A failed refresh keeps what is showing (`unusual-activity-store.ts`).
- The page includes the unusual-activity notification switches, saved to `unusual_activity_preferences`.
- The route requires a session although the data is public.

## Week ahead — `/semana`

- `/api/account/week-ahead` reads `issuer_dividends`, the calendar for the next civil week in Luanda (`get_market_calendar`), the ledger's held instruments and the catalogue (`src/features/week-ahead/server.ts`).
- A missing or unverified calendar withholds the whole week (`verified: false`).
- A read stays current for 5 minutes, and an event is kept only while every one of its sources was retrieved less than 5 minutes ago (`MAXIMUM_EVENT_AGE`, `src/domain/week-ahead/week-ahead.ts`). After a failed read, the batch read earlier is replayed for up to one day, marked as saved (`REPLAY_AGE`, `src/features/week-ahead/week-ahead-store.ts`).
- The view refreshes every 60 seconds.

## Lessons — `/aprender`

Seven lessons of three sections each. The text is in the message catalogue (`learn.{id}.title`, `learn.{id}.{1..3}.heading|body`). Opened lessons are recorded in `localStorage` under `investao.learn.read` (`src/features/learn`).

## Tests

`tests/e2e/market.spec.ts`, `market-information.spec.ts`, `unusual-activity.spec.ts`, `week-ahead.spec.ts`, `public.spec.ts`; unit tests beside the modules in `src/domain/market`, `src/data/market`, `src/domain/week-ahead`, `src/domain/unusual-activity`, `src/data/news`.
