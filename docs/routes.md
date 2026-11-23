# Routes

Portuguese slugs serve both languages. Portuguese has no prefix; English is under `/en` (`localePrefix: "as-needed"`, `src/i18n/routing.ts`). Page files are under `src/app/[locale]`.

"Host" applies only when `APP_URL` is set ([architecture.md](architecture.md)): **site**, **app**, or **both** (the market pages: app host for a signed-in visitor, site host otherwise).

"Session": **none**, **required** (the proxy and the `(app)` layout redirect to `/entrar`), or **optional** (more is shown when signed in).

"Plan" lists what the page locks without Plus. Plus locks apply only when `get_subscription_access().enforcement_enabled` is true and `is_plus` is false ([plus-and-web-passes.md](plus-and-web-passes.md)). The server enforces its own limits in every case.

## Public pages

| Route | Host | Session | Data loaded on the server | File |
|---|---|---|---|---|
| `/` | site | none | Cached catalogue for the market preview and counts (`homeMarket`) | `(site)/(home)/page.tsx` |
| `/plus` | site | none | `get_web_plans()` as `anon`, cached 300 s | `(site)/plus/page.tsx` |
| `/noticias` | site | none | Published articles; `?pagina=N` (1 to 10) renders N pages of 20; `?q=` title search | `(site)/noticias/(feed)/page.tsx` |
| `/noticias/[slug]` | site | none | One published article, catalogue rows for related instruments. Unpublished or malformed slug: 404 | `(site)/noticias/[slug]/page.tsx`, `layout.tsx` |
| `/aprender` | site | none | None (seven lessons from the message catalogue) | `(site)/aprender/(index)/page.tsx` |
| `/aprender/[lesson]` | site | none | None. Slugs: `bodiva`, `acoes`, `obrigacoes`, `ler-uma-cotacao`, `dividendos-e-cupoes`, `comprar-e-vender`, `risco-e-diversificacao` (`src/features/learn/lessons.ts`) | `(site)/aprender/[lesson]/page.tsx` |
| `/convite/[code]` | site | none | None. `noindex`, `referrer: no-referrer`. Stores the code in `sessionStorage` | `(site)/convite/[code]/page.tsx` |
| any other path | site | none | 404 inside the site chrome | `(site)/[...rest]/page.tsx` |
| `/policy` | site | none | None. Renders a draft notice and the support contact (`DraftLegalPage`) | `(store-linked)/policy/page.tsx` |
| `/termos` | site | none | Same | `(store-linked)/termos/page.tsx` |
| `/suporte` | site | none | Same, plus a link to `/eliminar-conta` | `(store-linked)/suporte/page.tsx` |
| `/eliminar-conta` | site | none | None. Links to `/entrar?next=/definicoes/conta` | `(store-linked)/eliminar-conta/page.tsx` |
| `/partilha/[token]` | site | none | `get_shared_portfolio` with the token in a POST body, then the catalogue. `noindex`; headers `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) | `(store-linked)/partilha/[token]/page.tsx` |
| `/entrar` | site | none (a signed-in visitor is redirected to `next`) | `currentAccount()`; `?next=`, `?motivo=sessao|falha|local|eliminada` | `(auth)/entrar/page.tsx` |

## Market pages

One set of pages for everyone. A signed-in visitor gets the app shell, a visitor gets the site chrome (`(market)/layout.tsx`).

| Route | Host | Session | Plan | Data loaded on the server | File |
|---|---|---|---|---|---|
| `/mercado` | both | optional | — | Market index (pulse), catalogue, `currentAccount()`. Query: `q`, `categoria` and sort parameters (`src/features/market/browse/query.ts`) | `(market)/mercado/(overview)/page.tsx` |
| `/mercado/[symbol]` | both | optional | Without Plus: `Tudo` range, history CSV export, liquidity, order-book levels beyond 5 | Instrument lookup (another spelling redirects, unknown is 404), one year of daily closes, issuer, latest dividend, reports | `(market)/mercado/[symbol]/page.tsx`, `layout.tsx` |
| `/mercado/admissao/[event]` | both | optional | — | Listing event from `market_events`; redirects to the instrument once confirmed and listed. `noindex` | `(market)/mercado/admissao/[event]/page.tsx` |
| `/mercado/informacao` | both | optional | — | Three newest articles. The updates come from the browser's market snapshot. `noindex` | `(market)/mercado/informacao/page.tsx` |
| `/mercado/informacao/[id]` | both | optional | — | None. `noindex` | `(market)/mercado/informacao/[id]/page.tsx` |

## Signed-in pages

All under `(app)`, host **app**, session **required**. Each also receives the app shell's data: watchlist ids, subscription access, catalogue rows and the unread flag (`src/features/shell/signed-in-frame.tsx`). An account that still needs setup sees `AccountSetup` instead of any of these pages.

| Route | Plan | Data loaded on the server | Data loaded in the browser | File |
|---|---|---|---|---|
| `/inicio` | — | Catalogue, three newest articles, released wraps, listing events | Market snapshot, watchlist, weekly reading, Plus prompt (`/api/billing/plans`) | `inicio/page.tsx` |
| `/lista` | Without Plus: 3 active instruments, 1 automatic-movement instrument, no groups, 2 alert rules (server limits) | Catalogue | `/api/account/watchlist`, `/api/account/alerts` | `lista/page.tsx` |
| `/carteira` | Without Plus: named portfolios, cash, benchmark, statement reading, year report, share links | Catalogue, benchmark rates | `/api/account/portfolio` | `carteira/page.tsx` |
| `/carteira/[id]` | — | Catalogue. `id` is an instrument UUID; anything else is 404 | `/api/account/portfolio` | `carteira/[id]/page.tsx` |
| `/carteira/registos` | — | Catalogue | `/api/account/portfolio` | `carteira/registos/page.tsx` |
| `/carteira/rendimentos` | Without Plus: totals (`requestUpgrade("income")` in `src/features/portfolio/income-view.tsx`) | Catalogue, recent dividends | `/api/account/portfolio` | `carteira/rendimentos/page.tsx` |
| `/pesquisa` | — | Catalogue | Market snapshot | `pesquisa/page.tsx` |
| `/atividade` | — | Catalogue (symbols) | `/api/account/activity` | `atividade/page.tsx` |
| `/atividade-invulgar` | — | Catalogue | `/api/market/unusual-activity`, `/api/account/notification-preferences` | `atividade-invulgar/page.tsx` |
| `/semana` | — | None | `/api/account/week-ahead` | `semana/page.tsx` |
| `/simulador` | — | None | Market snapshot | `simulador/page.tsx` |
| `/wrap/[period]` | — | None. The page renders only its title (`SignedInPage` with no content) | — | `wrap/[period]/page.tsx` |
| `/planos` | — | None | `/api/billing/plans`, `/api/billing/order/[id]`, `/api/account/access` | `planos/page.tsx` |
| `/definicoes` | — | Account profile (`auth.getUser()`, `user_profiles`) | `/api/account/notification-preferences` | `definicoes/page.tsx` |
| `/definicoes/conta` | — | Account profile; `?eliminacao=` shows the result of a deletion attempt | — | `definicoes/conta/page.tsx` |

## Development pages

Built only when the data mode is not `production` (`next.config.ts`). Both are `noindex` and disallowed in `robots.txt`.

| Route | File |
|---|---|
| `/dev/design` (component gallery) | `dev/design/page.dev.tsx` |
| `/dev/market` (market store over the cached catalogue; demo `?scenario=`) | `dev/market/page.dev.tsx` |

## Route handlers

Files are under `src/app`. "Auth" is the check in the handler.

### Auth

| Route | Method | Behaviour | File |
|---|---|---|---|
| `/auth/sign-in` | GET | Starts Google or Apple OAuth; `?provider=`, `?next=` | `auth/sign-in/route.ts` |
| `/auth/callback` | GET | Exchanges the code, enrols setup, redirects to `next` | `auth/callback/route.ts` |
| `/auth/sign-out` | POST (same origin) | Signs out, clears cookies | `auth/sign-out/route.ts` |
| `/auth/local-password` | POST (same origin) | Password sign-in. Exists only in `local` builds | `auth/local-password/route.local.ts` |

### Public data

| Route | Method | Answer | Cache-Control | File |
|---|---|---|---|---|
| `/api/market/snapshot` | GET | The `market-snapshot` Edge Function's body, `ETag`, `x-investao-generated-at`; 304 on a matching `If-None-Match` | `public, max-age=<remaining>, s-maxage=<remaining>, stale-while-revalidate=5`; failures `no-store` | `api/market/snapshot/route.ts` |
| `/api/market/history/[id]` | GET | `{points}`: one year of daily closes of a listed instrument; 404 for an unknown id | `public, max-age=300` | `api/market/history/[id]/route.ts` |
| `/api/market/unusual-activity` | GET | `{rows}` from `get_unusual_activity` as `anon` | `no-store` | `api/market/unusual-activity/route.ts` |
| `/api/news` | GET | `{articles}`; `?offset=&limit=` (limit at most 201, default 21) or `?q=` (at most 100 characters) | `public, max-age=60` | `api/news/route.ts` |
| `/api/logos/[issuer]` | GET | The issuer's logo image fetched server-side (timeout 4 s, at most 512 KiB, HTTPS only) | Hit: one day plus `stale-while-revalidate=604800`; miss: one hour; failure: 5 minutes | `api/logos/[issuer]/route.ts` |
| `/og/[image]` | GET | Open Graph card `{locale}-{page}.png`, generated at build time | — | `og/[image]/route.tsx` |
| `/og/news/[slug]` | GET | Open Graph card of one article | `public, max-age=3600` | `og/news/[slug]/route.tsx` |
| `/.well-known/assetlinks.json` | GET | Android App Links statement list; `[]` until both Android variables are set | `public, max-age=3600` | `.well-known/assetlinks.json/route.ts` |
| `/robots.txt`, `/sitemap.xml` | GET | See [seo.md](seo.md) | — | `robots.ts`, `sitemap.ts` |

### Account data

All answer 401 `{error: "signed_out"}` without a verified session, 503 `{error: "unavailable"}` on a read failure, and carry `Cache-Control: private, no-store`. Every success body includes `userID`.

| Route | Method | Answer | File |
|---|---|---|---|
| `/api/account/access` | GET | `{access}` | `api/account/access/route.ts` |
| `/api/account/watchlist` | GET | `{items, groups, access, sensitivity}` | `api/account/watchlist/route.ts` |
| `/api/account/alerts` | GET | `{rules}` | `api/account/alerts/route.ts` |
| `/api/account/activity` | GET | One page; `?before_created_at=&before_id=` (both or neither; 400 `invalid_cursor`) | `api/account/activity/route.ts` |
| `/api/account/notification-preferences` | GET | `{preferences}` | `api/account/notification-preferences/route.ts` |
| `/api/account/portfolio` | GET | Ledger at one revision, `books`, `cash` | `api/account/portfolio/route.ts` |
| `/api/account/portfolio/shares` | GET | `{shares}`; `?portfolio=main` or a UUID (400 `invalid`) | `api/account/portfolio/shares/route.ts` |
| `/api/account/history/[id]` | GET | `{points}`: every daily close the account may read | `api/account/history/[id]/route.ts` |
| `/api/account/intraday/[id]` | GET | `{chart}` from `get_intraday_chart` | `api/account/intraday/[id]/route.ts` |
| `/api/account/order-book/[id]` | GET | `{book}` | `api/account/order-book/[id]/route.ts` |
| `/api/account/intelligence` | GET | One week's evidence, publications and ledger; `?starts_on=&ends_on=` (400 `period`) | `api/account/intelligence/route.ts` |
| `/api/account/week-ahead` | GET | The coming week's dated events | `api/account/week-ahead/route.ts` |
| `/api/account/delete` | POST (same origin, form) | Deletes an account without Apple sign-in; redirects | `api/account/delete/route.ts` |
| `/api/account/apple-deletion/start` | POST (same origin, form) | Redirects to Apple's authorization URL | `api/account/apple-deletion/start/route.ts` |
| `/api/account/apple-deletion/complete` | GET | Verifies the signed receipt; redirects | `api/account/apple-deletion/complete/route.ts` |

### Billing

Failures answer `{error, orderID?}` with the statuses in `WEB_CHECKOUT_FAILURE_STATUS` (`src/domain/billing/web-pass.ts`).

| Route | Method | Answer | File |
|---|---|---|---|
| `/api/billing/plans` | GET | `{plans, orders}` | `api/billing/plans/route.ts` |
| `/api/billing/checkout` | POST (same origin, JSON `{productID, method, phone?, nif?}`) | `{order}` | `api/billing/checkout/route.ts` |
| `/api/billing/order/[id]` | GET | `{order}` after the server asked the payment provider | `api/billing/order/[id]/route.ts` |
| `/api/billing/order/[id]/cancel` | POST (same origin) | `{order}` | `api/billing/order/[id]/cancel/route.ts` |
