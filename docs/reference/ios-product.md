# invest.ao — iOS product, UX and design-system inventory

Source: clean snapshot of the iOS repo `origin/main`, marketing version **1.1.5 (build 18)**, bundle `ao.invest.iosapp`, App Store id `6812907673`. All paths are relative to the snapshot root. Networking, data contracts, auth plumbing, push delivery and subscription plumbing are covered by a separate document; this one covers what the user sees and does, the rules behind it, and the design language.

**Conventions**

- Copy is quoted as `PT` (EN). Both come from `Invest.AO/Resources/Localizable.xcstrings`.
- "Plus" / "Pro" locks are enforced only when the build has subscriptions enabled (`INVESTAO_SUBSCRIPTIONS_ENABLED = YES` in `Configuration/Production.xcconfig`) **and** the server access snapshot reports `enforcement_enabled`. Otherwise every gated feature is open.
- Every date and time is evaluated and displayed in `Africa/Luanda` (`Calendar.market`), in the app locale (`pt_AO` or `en_AO`).
- Code is the truth. Where a doc under `docs/` disagrees, the code behaviour is reported and the disagreement is listed in section 11.
- `UNVERIFIED` marks anything not confirmed from code. Section 11 collects them.

**How this was produced.** Sections 2.7–2.13 and 2.C1–2.C3 (asset details, simulator, alerts, portfolio, watchlist, weekly wrap, news, learn, activity center) come from a full read of those feature folders. Sections 1, 2.1–2.6, 2.14–2.18 and 3–10 come from a full read of the app shell, Home and the listed docs, plus a structural read (view outline + every localized string) of Markets, Search, Week Ahead, Unusual Activity, Settings, Subscriptions, widgets and intents. The design-system component catalog (3.7) was built from type declarations and docs, not from a line-by-line read of every component file.

**Contents**

1. App shell and navigation
2. Features (2.1 Home … 2.18 App availability)
3. Design system
4. Product voice, copy, localization and formatting
5. Cross-cutting UX
6. Subscription UX
7. System surfaces
8. Product rules to inherit
9. Store listing
10. Prioritized parity checklist (with web applicability)
11. Doc-vs-code disagreements and UNVERIFIED items

## 1. App shell and navigation

Files: `Invest.AO/App/{InvestAOApp,AppRootView,ApplicationShell,PendingNotificationRoute}.swift`, `App/Navigation/AppTab.swift`, `Features/Authentication/AuthenticationRootView.swift`, `Features/Onboarding/AuthenticatedAccountRootView.swift`, `Features/AppAvailability/AppAvailabilityGate.swift`.

### 1.1 Root state machine

Evaluated top to bottom; the first match wins.

| # | Condition | What the user sees |
|---|---|---|
| 0 | Remote flag: forced update or maintenance (section 2.18) | Full-screen blocking screen that replaces everything, including login, onboarding and open sheets |
| 1 | Session restoration in progress | Launch splash (logo on near-black `#02050A`), stays until restoration finishes |
| 2 | First launch on this device, no session | 3-page introduction carousel (2.14) |
| 3 | Session restoration failed for connectivity reasons | Title `Não foi possível recuperar a sessão` (Could not recover the session), message `Verifica a ligação e tenta novamente.` (Check your connection and try again.), button `Tentar novamente` (Try again) |
| 4 | Signed out (introduction already seen) | Authentication screen (2.15) — **the whole app is behind sign-in on a fresh start** |
| 5 | Signed in, account needs setup | Post-login setup: name → first watchlist (2.16) |
| 6 | Signed in | Tab shell. If a subscription offer is pending from onboarding and the account is Free, the paywall opens once with reason `onboarding` |

Transitions between root states are 0.28–0.35 s ease-in-out cross-fades (0.12 s or none under Reduce Motion).

Signed-out vs signed-in: `ApplicationShell` still contains guest branches (Portfolio and Watchlist tabs render the authentication screen when there is no user; the Home profile button opens authentication instead of Profile; Activity and the simulator show inline sign-in). In the shipped root flow those are reached only transiently (session expiry, account deletion, sign-out while the shell is on screen), because root state 4 replaces the shell. A new platform can decide either way; **the iOS product as shipped requires an account to see market data.** The web app is the natural place to revisit this (public market pages are an obvious SEO surface) — that would be a product change, not parity.

On sign-out the app clears market, alerts, portfolio, wrap, intelligence, market-event, personalisation and activity caches. After account deletion it shows the alert `Conta eliminada` (Account deleted) with the message `app.accountDeleted.message`.

### 1.2 Tabs

Native bottom tab bar, never minimised on scroll, hidden on pushed detail screens.

| Order | Tab id | Label PT (EN) | Icon (custom pack) | Root content | Signed-out content |
|---|---|---|---|---|---|
| 1 | `home` | `Início` (Home) | `invest.home` | `HomeView` | same |
| 2 | `markets` | `Explorar` (Explore) | `invest.markets` | `MarketsView`, opens with category **Ações** preselected | same |
| 3 | `portfolio` | `Carteira` (Portfolio) | `invest.portfolio` | `PortfolioView` | authentication screen |
| 4 | `watchlist` | `Lista` (Watchlist; key `common.watchlistTab`) | `invest.watchlist` | `WatchlistView` | authentication screen |
| 5 | `search` | `Pesquisa` (Search) | `invest.search` | `SearchView` | same |

Note the enum order in `AppTab.swift` (home, markets, portfolio, search, watchlist) differs from the rendered order above; the rendered order in `ApplicationShell.tabs` is the truth and matches `docs/LAYOUT_REDESIGN.md`.

Each tab owns its own navigation stack. Tab selection is reported as a screen-view event.

### 1.3 Destinations

There is no central route enum. Navigation is typed by value:

| Value pushed | Destination | Pushed from |
|---|---|---|
| `MarketSecurity` | Asset details | Home, Markets, Search, Watchlist, Unusual activity, News, Activity |
| `MarketUpdate` | Market update detail | Home "Mercado" section, Markets |
| `WeekAheadPeriod` | Week ahead | Home context card, Home saved-calendar link |
| Home booleans | Unusual activity, Simulator access | Home toolbar / simulator entry row |
| Markets links | News archive, Learn, Market information | Markets screen |
| `WatchlistView(showsBackButton: true)` | Watchlist (pushed variant, tab bar hidden) | Home watchlist rail |
| `MarketsView(showsBackButton: true)` | Explore (pushed variant) | Home "Explorar o mercado", Search category cards |
| `PortfolioDestination` | Position detail, records, etc. | Portfolio (see 2.C1) |

Sheets and covers owned by the shell or Home:

| Presentation | Content | Trigger |
|---|---|---|
| Sheet | Profile + Settings (or authentication when signed out) | Home profile-initials button |
| Sheet (large) | Activity center (or authentication) | Home bell |
| Sheet | Market session overview (index chart + metrics) | "Ver detalhes do mercado" on the Home overview card |
| Full-screen cover | Weekly Wrap player | Home context card, recap menu, push, deep link |
| Sheet | Discover insight detail / news article / portfolio insight | Saturday Discover row |
| Sheet | Asset details in its own stack | Push notification, widget, Spotlight, Siri |
| Sheet | News article | Push notification |
| Sheet | Portfolio insight detail | Push notification |
| Sheet | Unusual activity | Push notification (digest) |
| Full-screen cover | Paywall (`SubscriptionManagementView`) | Any gated action, on the surface that requested it |
| Sheet | Lifetime Plus gift announcement | Automatically, once, when the account holds a gift and nothing else is on screen |

### 1.4 External entry routing

`PendingNotificationRoute` holds one pending route of each kind and survives cold launch, onboarding, sign-in and market loading:

| Source | Payload | Result |
|---|---|---|
| Widget / deep link `investao://market` | — | Home tab |
| `investao://watchlist` | — | Watchlist tab |
| `investao://portfolio` | — | Portfolio tab |
| `investao://security?id=<id>` | instrument id (≤128 chars) | Markets tab + asset-details sheet; if the id is unknown after one live load, error toast "unavailable instrument" |
| `investao://wrap/<period-key>` | e.g. `weekly-YYYY-MM-DD` | Home tab + Wrap cover; alert `Wrap indisponível` if expired |
| Spotlight result | instrument id | same as `security` |
| Push, schema 2 | `notification_id`, `category` ∈ asset_movement, market_listing, market_recap, news_publication, portfolio_daily, weekly_wrap, unusual_activity, daily_close | The app fetches the account notification record and routes by its content: wrap → Wrap; frozen portfolio insight → insight sheet; unusual-activity digest → Unusual activity sheet; BODIVA market update → no navigation; article id → article sheet; security id → asset sheet; otherwise error toast |
| Push, legacy | `wrap_period` / `article_id` (+ `recap_receipt_id`) / `security_id` | Wrap / article sheet (marks the recap read) / asset sheet |

A push for a different account than the signed-in one is ignored; a push while signed out opens authentication first. If Profile is open when a route arrives it is dismissed first.

### 1.5 Background behaviour visible to the user

- Foreground market refresh: every 30 s while the market is open, 60 s when closed or opening soon, 120 s when the realtime announcement feed is connected (polling is then only a watchdog). Failures back off exponentially with jitter up to 5 min; the server can raise the floor and can signal maintenance (300 s cadence). `Core/Market/Domain/Policies/MarketRefreshPolicy.swift`.
- Portfolio reloads every 60 s in the foreground; watchlist insights every 60 s; Home context every 60 s; news every 60 s.
- When the app leaves the foreground, current quotes are revoked immediately (content stays, prices become "unconfirmed" until fresh evidence arrives on return).
- The Live Activity for the BODIVA session is started/ended on foreground and on calendar changes (section 7).

## 2. Features

Feature folders present under `Invest.AO/Features`: Alerts, AppAvailability, AssetDetails, Authentication, Home, Learn, Markets, News, Notifications, Onboarding, Portfolio, Profile, Search, Settings, Simulation, Subscriptions, UnusualActivity, Watchlist, WeekAhead, WeeklyWrap. There are no others.

### 2.1 Home (`Início`)

**Purpose.** One scrolling answer to "what is the market doing and what should I look at now". Files: `Features/Home/**`, `Core/Intelligence/HomeContextResolver.swift`, `docs/home-context-priority.md`.

**Gating.** Reached only when signed in (section 1.1). No tier lock on Home itself; the market-overview sheet's range picker is history-gated (Free up to `1A`, Plus `Tudo`).

#### Toolbar

| Position | Control | Action |
|---|---|---|
| Leading | Profile initials (first letter of first and last name, uppercase; `I` when no name), semibold subheadline, min 28×28. VoiceOver: `Perfil de {nome}` | Opens Profile sheet |
| Trailing 1 | Icon `waveform.path.ecg`, label `Atividade invulgar` (Unusual activity) | Pushes Unusual activity |
| Trailing 2 | Bell; switches to bell-with-badge when the Activity center has any "new" group. VoiceOver value `Há atividade nova` / `Sem atividade nova`. Re-evaluated every 60 s. No numeric count | Opens Activity sheet |

There is no greeting header in the shipped Home (strings `Bom dia / Boa tarde / Boa noite` and a `HomeHeader` component exist; their use in the live layout is `UNVERIFIED` — the toolbar above is what `HomeView` renders).

#### Sections in display order (content state)

Vertical spacing between sections 20 pt on phones (32 pt on wide layouts), horizontal page margin 20 pt, top 12 pt, bottom 40 pt.

**1. Market overview card — `Panorama do mercado` (Market overview).** The one card on Home (card surface, radius 24, padding 20).

| Row | Content | Format |
|---|---|---|
| Header | Title + market status indicator (dot + `Aberto` / `Fechado` / `Em breve` / `Indisponível`) | Stacks vertically at accessibility text sizes |
| Index block (when index value and trading date exist) | Index name (caption, secondary) · value · percent-change badge · closing reference label (`Fechos de {data}`) · 100×64 sparkline of the last 30 index points in accent blue, 2 pt round line, no axes | Value: 2 decimals, large-title semibold, tabular digits, numeric roll animation 0.25 s |
| Index placeholder (index loading/failed) | Section placeholder with `Não foi possível carregar estes dados.` + `Tentar novamente` | — |
| Session statistics (when usable) | `Volume da sessão` → integer + caption `títulos negociados`; `Negócios` → integer | Integers grouped per locale; title2 semibold tabular |
| No statistics | If the index is also missing: label `Instrumentos com fecho verificado` (or `Instrumentos disponíveis` when none) + count, then `O indicador e os totais da sessão ainda não têm dados verificados.`; if only totals are missing: `Os totais da sessão ainda não têm dados verificados.` | — |
| Divider + button | `Ver detalhes do mercado` (View market details) with chevron, accent colour, 44 pt min height | Opens the Market session sheet |

**2. Watchlist rail — `A tua lista` (Your watchlist).** Header with an arrow button (44×44) that pushes the Watchlist. Horizontal scroller of up to **6** watched instruments in the user's saved order. Each tile (176 pt wide; 280 pt at accessibility sizes; card surface, radius 24, padding 20): 36 pt logo + small arrow, symbol (semibold body), kind title (caption), price (2 decimals, kind-aware format), percent-change badge; or `Preço por confirmar` (Price unconfirmed) when no display price. Tap → asset details.
- Empty: a tinted action row `Começa pelos teus favoritos` / `Escolhe instrumentos para veres aqui as suas cotações.` with a plus icon → Watchlist.
- Loading/failed: section placeholder with retry.
- On wide layouts the rail moves below the context slot.

**3. Context slot (at most one item).** Either the Saturday Discover list or a single context card; never both. Rules in "Context slot rules" below.

**4. Movement feed — `Em movimento` (On the move).** Segmented tabs `Subidas` (Gains) · `Descidas` (Declines) · `Volume`. Shows the **top 3** instruments with a usable current quote: gains sorted by % change descending (>0), declines ascending (<0), volume by traded volume descending (>0). Rows are the shared asset row (48 pt logo, symbol, name, price, change badge). Empty copy: `Sem movimentos disponíveis nesta categoria.` when quotes exist but the category is empty; `Cotações atuais indisponíveis. Voltamos a tentar automaticamente.` when no current quotes. Below: secondary capsule button `Explorar o mercado` (Explore the market) → pushed Explore. Loading: skeleton rows (animated only on the first foreground load).

**5. News — `Notícias`.** Up to 3 publications (see 2.11).

**6. Market updates — `Mercado`** (only when updates exist). Card with up to 3 update rows separated by hairlines; tap → market update detail.

**7. Recap menu — `Resumos disponíveis` (Available summaries)** (only when there are visible Wrap periods other than the one in the context card). A quiet menu row listing `{tipo} · {intervalo}`; selecting opens the Wrap.

**8. Simulator entry** — row linking to the investment simulator (2.8).

Above everything, when the trading calendar is unavailable, two fallback links can appear: `Abrir Wrap guardado` (Open saved Wrap) with `Preparado em {timestamp}` and `Abrir agenda guardada` (Open saved calendar).

#### Market session sheet (`Sessão de mercado`)

Opened from the overview card. Close button top-leading. Content:
- Hero: index name (or `Síntese do mercado` when the index is unavailable) + info button (opens the indicator explanation sheet) + status pill (7 pt dot: green open, amber opening soon, red closed/unknown). Subtitle `Baseado em cotações do mercado BODIVA` or `Últimos dados publicados pela BODIVA`.
- Index value in the 44 pt financial headline, 2 decimals; daily change `±0,00 (±0,00%)` coloured by direction.
- 160 pt index chart + range picker (`1D 1S 1M 3M 6M 1A Tudo`); `1D` disabled when the session has 0 trades; `Tudo` is Plus-gated; the picker is disabled while history loads or when fewer than 2 points exist; overlay text when the series is unavailable.
- Without an index: session volume headline + `Títulos negociados · {n} negócios`, or `A aguardar atualização da sessão`; then `{n} subidas` / `{n} descidas` counts with arrows and the caption `Instrumentos com variação disponível nesta atualização`.
- Metrics strip (3 columns; stacks at xxxLarge text): `Volume negociado` → `{n} títulos`; `Negócios` → integer; `Instrumentos` → count with caption `DISPONÍVEIS`. Missing values render `—`. Sub-captions are uppercase (`ÚLTIMA SESSÃO DISPONÍVEL`).
- Loading: spinner `A carregar o mercado completo…`. Error: shared error state with retry.

Indicator explanation sheet (`SyntheticIndexInfoSheet`): sections `O que é`, `Como é calculado` (base 100; equal weight; per-instrument change between verified closes of consecutive sessions, at least two instruments; cumulative), `Fonte dos dados`, `Aviso legal`. Legal text states the **Indicador invest.ao** is calculated by invest.ao, is not an official BODIVA index and is not advice.

#### States

| State | Presentation |
|---|---|
| Loading (first load) | Skeleton Home (`HomeLoadingView`) with the simulator entry and news already live; VoiceOver `A carregar dados de mercado` |
| Loaded from cache, no live snapshot yet | Skeleton, unless cached verified closing references exist — then content with dated closes |
| Failed, nothing to show | Simulator entry + shared error state with retry + news |
| Failed, but a saved Wrap or saved agenda is replayable | `Alguns dados aguardam atualização.` + `Atualizar` button + news |
| Refresh failed with content on screen | Content stays; compact error toast `Não foi possível atualizar o mercado` with retry |
| Offline | Offline banner `Sem ligação à Internet` / `Os dados podem estar desatualizados.`; current quotes revoked (rows show `Preço por confirmar`), dated verified closes remain |
| Pull to refresh | Reloads market (forced), Wrap availability and news |

All section changes animate as presence transitions (fade, optional move), disabled under Reduce Motion.

#### Context slot rules (`HomeContextResolver`)

Evaluated in Africa/Luanda using a verified, unexpired trading calendar (calendar inputs expire within 2 minutes or at local midnight). If the calendar is unknown/expired or the device is offline, the slot is empty.

| Market context | What fills the slot | Fallback |
|---|---|---|
| Market open | Nothing | — |
| Friday after close | Latest released, not-yet-completed verified Weekly Wrap. Headline preference: portfolio price return → complete-watchlist highlight → labelled market sample | Empty |
| Saturday (verified closed day) | Saturday Discover list (below). If Discover is empty: one personal fact from the Wrap (portfolio return, then largest complete-watchlist move), then one qualified unconsumed watchlist observation | Empty |
| Sunday (weekend/closed/holiday) | Week Ahead offer, only if next week has ≥1 eligible sourced event | Empty |
| Pre-market, other post-close, holiday, explicit closure, unknown | Nothing | — |

Context card anatomy (elevated surface, radius 24, padding 24): uppercase accent eyebrow (caption2 bold, 1.5 tracking), optional 42 pt icon tile, headline (title3 semibold), detail (subheadline, secondary), action label + arrow in accent. Copy variants:

| Variant | Eyebrow | Headline | Detail | Action |
|---|---|---|---|---|
| Portfolio week | `A TUA SEMANA · {intervalo}` | `As tuas posições variaram {x%} na semana` | `Variação de preço das posições iniciais, entre fechos verificados.` | `Ver o meu Wrap` |
| Watchlist mover | `NA TUA LISTA · {intervalo}` | `{SÍMBOLO} variou {x%} esta semana` | `Maior variação da tua lista entre fechos verificados.` | `Ver o meu Wrap` / `Ver a minha lista` |
| Market sample | `FECHO DA SEMANA · {intervalo}` | `{n} de {m} títulos observados subiram` | `Amostra com fechos verificados; não representa um índice BODIVA.` | `Ver o Wrap` |
| Week ahead | `PRÓXIMA SEMANA` | `{n} {eventos} para a próxima semana` (+ portfolio/watchlist counts) | `{intervalo} · Datas anunciadas nas fontes.` | `Preparar a semana` |
| Discover (reserved) | `PARA DESCOBRIR` | — | — | `Descobrir` |

Rules: no personal monetary amount or holding quantity ever appears on Home. Privacy mode removes personal percentages and watched symbols immediately (Friday may fall back to the public market sample; Saturday may disappear). Completing a Wrap removes it from the slot (it stays in the recap menu); an unfinished Wrap can be resumed from the card. The card disappears at its expiry even if refresh fails.

**Saturday Discover** (`docs/saturday-discover-phase6.md`, `Core/Intelligence/SaturdayDiscoverRanking.swift`). Header `Para explorar este sábado` + `Uma seleção do que aconteceu no mercado e nos títulos que segues.` Rows separated by hairlines, each: category label with icon in accent (`DA TUA CARTEIRA`, `DA TUA LISTA`, `PUBLICAÇÃO · {tipo}` …), headline, context line, reason line (`Relacionada com a tua carteira` / `Relacionada com a tua lista`). Tap opens the insight detail sheet, or the news article for publication items.
- Max **5** items, no minimum, no padding. Max 2 per category (portfolio, watchlist, market, news), max 2 per insight type and per focal asset. First slot reserved for the top portfolio-wide performance fact.
- Deterministic score: portfolio relationship 80; watchlist 40 (never stacked); significance 10/20/30 at |move| ≥ 1% / 3% / 5%; recency 12 (≤24 h) / 8 (≤72 h) / 4; novelty 10 (−2 when a similar read item exists in Activity); first-party interest ≤5 (0 in privacy mode); market importance 10 for market price facts ≥5%. Sort: score desc, timestamp desc, id asc.
- Eligibility: Saturday in Luanda on a verified closed day; every fact unexpired, fetched <15 min ago, observation/publication <7 days old, referenced instruments still listed. Consumed items (opened, or read in Activity) are excluded.

**New-listing highlight.** `docs/market-listing-events.md` specifies that a sourced new-admission event takes the context slot directly after the overview: issuer logo in an open circular "welcome mark" with a small status pill (`Por confirmar` / `Já na BODIVA`), eyebrow `Nova admissão`, action `Conhecer a empresa`, phase copy `Está quase a chegar` → `É o dia previsto` → `Newcomer in the building! 👋` → `Novo no mercado`; one-time auto-scroll + reveal animation with a light haptic on first upcoming and first confirmed appearance (persisted per event id); lifecycle upcoming → scheduled today → confirmed → recently listed → ordinary asset; overdue unconfirmed stays "awaiting confirmation". The component (`Features/Home/Components/MarketEventHighlight.swift`) and coordinator exist, and the pre-admission asset page is implemented (2.7), but no call site inserting the highlight into the Home layout was found: **wiring on Home is `UNVERIFIED`**.

**Foldables.** On iOS 27.1+ devices reporting an active fold, Home splits into a market pane and a watchlist pane (up to 8 rows) on either side of the fold. Android foldables/tablets are the direct equivalent.

### 2.2 Explore / Markets (`Explorar`)

**Purpose.** Browse, filter and sort the full instrument catalogue; gateway to News, Learn and market information. Files: `Features/Markets/**`, `Core/Market/Domain/Models/MarketDiscovery.swift`.

**Sections in display order (phone)**

1. Page title `Explorar`.
2. Search button styled as a field: `Procurar símbolo, nome ou emitente` → opens a full-height search sheet (`InstrumentSearchResultsView`).
3. Category picker: `Todos` · `Ações` · `Obrigações` · `Fundos` · `Tesouro`. The tab opens on **Ações**; the pushed variant from Home opens on `Todos`; from Search category cards it opens on the tapped category.
4. Sort controls: result count (`{n} título(s)`), sort-key menu `Ordenar por` — `Variação` (default) · `Preço` · `Volume` · `Nome` — and a direction toggle `Descendente` (default) / `Ascendente` with arrow icon and selection haptic.
5. Results list: asset rows separated by hairlines; tap → asset details.
6. Disclosure `Dados da sessão` (Session data): publication timestamp `Publicado {data, hora}` or `Data de publicação indisponível`, index summary with info button, and facts `Títulos negociados`, `Transações`, `Negociados verificados`.
7. Link row `Notícias` → news archive.
8. Link row `Aprender` (Learn) → lessons.
9. Market information summary (only when updates exist) → market information screen (2.11).

**Rules**

- Category mapping: Ações = equity; Obrigações = corporate bond; Fundos = fund unit; Tesouro = treasury bond.
- Visibility: an instrument is listed when the server marks it visible, otherwise when it is listed and not a matured bond. Bond maturity is decoded from the 8-character BODIVA symbol (2 letters, day, month letter code, 2-digit year, 1 suffix); matured bonds are hidden outside search.
- Text filter: case- and diacritic-insensitive contains on symbol, name, issuer.
- Sorting: for `Variação` and `Preço`, instruments without a value always sort last regardless of direction; ties break by symbol ascending. `Nome` uses natural (numeric-aware) ordering.
- Free-plan paused watchlist items and tier do not affect this list.

**States.** Loading skeleton list (VoiceOver `A carregar instrumentos de mercado`); error state with retry; refresh-failure toast; pull to refresh. Empty: `Sem instrumentos` + `Os instrumentos disponíveis aparecerão aqui quando houver dados de mercado.` (icon trend-up) when the catalogue is empty; `Sem resultados` + `Altera a pesquisa ou seleciona outra categoria.` with recovery button `Limpar filtros` when filters exclude everything.

**Wide layout.** On regular width (not shipped on iPad — the app targets iPhone only — but reachable on large phones in landscape/split) it becomes a master–detail split: list with inline search field, category picker and sort controls on the left (300–440 pt), asset details on the right, first result auto-selected, placeholder `Seleciona um instrumento`. This is the reference for the web app's desktop layout.

### 2.3 Search (`Pesquisa`)

**Purpose.** Find an instrument fast; star it without leaving the list. Files: `Features/Search/**`.

**Idle screen (query empty, field not focused)**

1. Page heading `Encontrar` (Find) / `Símbolos, emitentes e instrumentos` — hidden while the field is focused.
2. Search field, prompt `O que procuras?` (What are you looking for?), clear button.
3. Category grid (adaptive, min 140 pt columns): one tinted card per category (Ações, Obrigações, Fundos, Tesouro) with its **real catalogue count**; tap → pushed Explore filtered to it.
4. `Recentes` (Recent) with action `Limpar` (Clear): instruments the user opened from search, most recent first, **max 8**, stored on device.
5. `Maior volume` (Highest volume) with note `Ordenado pelo volume disponível de cada instrumento.`: top **6** by volume, ties by symbol.

**Results (field focused or query present).** Empty query + focus lists every visible instrument. Otherwise results from the global query (symbol, name, issuer; accepts both `ação` and `acção` spellings per `docs/product-copy.md`), grouped by instrument kind with section headers. Empty: `Não encontrámos títulos para "{consulta}".`

**Row.** Logo, symbol, name, price/change, and a star toggle. Star → add/remove from watchlist with snappy 0.24 s animation and selection haptic; VoiceOver `Adicionar {símbolo} à lista de acompanhamento` / `Remover …`. Adding a 4th instrument on Free opens the paywall and retries after upgrade. Tap → asset details and records the instrument in Recents.

**States.** Loading skeleton (`A carregar pesquisa de títulos`), shared error state, refresh toast. Keyboard dismisses on scroll.

### 2.4 Week ahead (`Semana à frente`)

**Purpose.** A sourced agenda of dates already announced for next Monday–Friday. No forecasts. Files: `Features/WeekAhead/**`, `Core/Intelligence/WeekAheadPolicy.swift`, `docs/week-ahead-phase7.md`.

**Entry.** Home context card on Sunday; Home "saved calendar" fallback link. No tab, no tier lock.

**Screen**

1. Optional banner for a cached batch: `Agenda guardada · atualizada em {timestamp}. Alterações por confirmar.`
2. Title `A tua semana à frente`, the week range, and relationship summary lines (`{n} {eventos} com ações na tua carteira`, `{n} {eventos} com a tua lista.`). Hidden in privacy mode.
3. Day sections — only days that have events. A day the verified calendar marks as non-trading gets `Sem sessão no calendário verificado. As datas anunciadas mantêm-se.`
4. Event rows: title (`Pagamento de dividendos`, `Data de registo para dividendos`, `Data ex-dividendo`), issuer, timing (`{data} · Hora não anunciada`; ranges; ` · Luanda` suffix for timed events), status (`Data anunciada` / `Data provisória · A confirmar` / `Cancelado`), relationship badge (`Relacionado com ações na tua carteira` / `Relacionado com a tua lista`), `Exercício de {ano}`, source link, publication date or `Data de publicação da fonte não disponibilizada`, `Registo atualizado em {data}.`, and a `Data atualizada na fonte` badge when the date changed during this session.
5. `Sobre esta agenda` (About this calendar): three explanatory paragraphs (announced dates may change; a portfolio link does not confirm dividend entitlement; coverage is currently dividends only).

**Rules.** Live coverage is **dividend milestones only** (record, ex-dividend, payment) from issuer dividend records; only equities acquire the relationship. Period = next Monday 00:00 to Saturday 00:00 Luanda (on Monday, "next" means the following Monday). Ordering inside a day: portfolio-related, then watchlist-related, then market; explicit importance; confirmed before tentative; chronological; id. Newest revision wins; a cancellation suppresses older copies; conflicting same-revision claims are withheld. Source cache 5 minutes, no stale fallback.

**States.** `A verificar a agenda…` spinner; `Agenda indisponível` / `Não foi possível confirmar dados atuais para este período.` with retry; empty `Sem eventos verificados para este período` / `A ausência de eventos nesta agenda não confirma que não existam outros anúncios.`

### 2.5 Unusual activity (`Atividade invulgar`)

**Purpose.** Show, per instrument, signals that today's trading is outside its usual pattern. Files: `Features/UnusualActivity/**`.

**Entry.** Home toolbar icon; push notification digest (opens as a sheet). Viewing needs no tier. The bell (notification settings) appears only when signed in.

**Screen.** Title `Atividade invulgar`, subtitle = session date (abbreviated). Pull to refresh.

- Groups by instrument. If the user follows any affected instrument: section `Lista de acompanhamento` first, then `Mercado`. Shares are listed before bonds (release notes 1.1.4).
- Group = the standard asset row (tap → asset details) followed by one line per signal: a bold coloured value + grey label, and the event time (short, Luanda) on the right. Withdrawn orders are struck through with `Já não está no livro de ordens`.
- Footer disclaimer: `Informação de mercado. Não constitui recomendação de investimento.`
- Empty: `Sem atividade fora do habitual` with the disclaimer. Loading: `A carregar`. Error: shared error state.

**Signal kinds and wording**

| Rule id | Setting title PT (EN) | Signal line | Full sentence (VoiceOver / detail) |
|---|---|---|---|
| `large_trade` | `Negócios de grande dimensão` (Large trades) | `{valor}` `num só negócio a {preço}` | — |
| `large_order` | `Ordens de grande dimensão` (Large orders) | `{valor}` `ordem de compra a {preço}` / `ordem de venda a {preço}` | — |
| `volume_spike` | `Volume` | `{n}×` `o volume habitual` | `O volume de hoje é {n}× a mediana de {m} sessões.` |
| `trade_count_spike` | `Número de negócios` | `{n} negócios` `{k}× o habitual` | `{n} negócios hoje, {k}× a mediana de {m} sessões.` |
| `price_move` | `Variação de preço` | `{±x%}` `{k}× a variação típica` | `Variação de {x%} hoje, {k} desvios-padrão face ao habitual.` |
| `dormancy_break` | `Regresso à negociação` (Trading after a pause) | `1.º negócio` `em {n} sessões` | `Primeiro negócio em {n} sessões.` |
| `spread_change` | `Diferença compra/venda` (Spread) | `{x%}` `diferença compra/venda, {k}× a habitual` | `Diferença compra/venda de {x%}, {k}× a mediana.` / `… mais estreita que a mediana.` |
| `spread_shift`, `book_imbalance` | (not user-configurable) | `{x%}` `do livro do lado da compra/venda` | `{x%} do valor no livro de ordens é de compra/venda.` |

Thresholds are computed server-side; the client only renders observed vs baseline values. Direction colours: up = positive green, down = negative red.

**Notification controls (sheet, medium/large detents).** Master toggle `Títulos que sigo` (Securities I follow) plus per-rule toggles for the seven configurable rules above. Same control appears in Settings → Notifications.

### 2.6 Market-wide rules

**Session and calendar** (`Core/Market/Domain/Models/BodivaMarketCalendar.swift`, `docs/market-calendar-foundation.md`)

- Time zone `Africa/Luanda`; weeks start Monday.
- Configured normal hours **09:00–15:30**; opening inclusive, closing exclusive. The server calendar can override with special sessions, holidays and exceptional closures; a day can also be "unknown" (no verified coverage).
- Market status values and labels: `open` → `Aberto`; `closed` → `Fechado`; `openingSoon` → `Em breve`; `unknown` → `Indisponível`. Dot colours: open green, opening-soon amber, closed/unknown red.
- A weekday alone never proves the market is open or closed; all weekend/holiday behaviour requires a verified calendar. Calendar payloads live at most 2 minutes on the client.

**Instrument kinds and price semantics**

| Kind | Label PT (EN) | Price format | Change-amount format |
|---|---|---|---|
| `equity` | `Ação` (Stock) | AOA currency, 2 decimals | AOA currency, 2 decimals |
| `fund` | `Unidade de participação` (Fund unit) | AOA currency, 2 decimals | AOA currency |
| `corporateBond` | `Obrigação corporativa` (Corporate bond) | **percent of par**, ≥2 decimals, e.g. `98,50%` | percentage points, `±0,00 p.p.` |
| `treasuryBond` | `Obrigação do Tesouro` (Treasury bond) | percent of par | `p.p.` |
| `other` | `Outro instrumento` | currency | currency |

**Current-quote policy** (`docs/current-quote-policy.md`, code in `MarketSecurity` / `MarketStore`)

- During an open verified session a price counts as a *current quote* only with valid, unexpired quote quality, a matching Luanda trading date and an unexpired calendar boundary. Eligibility budget ≈ 2 minutes.
- Unknown/expired calendar, failed refresh, offline, prior-session data and app backgrounding all **revoke** the current quote. The UI then shows `Preço por confirmar` — **never zero, never a stale number presented as current**.
- Chart history, positions and transactions stay available when the quote is revoked.
- Portfolio valuation, simulator, alerts and insight calculations require a current quote. Without one, portfolio shows `Valor parcial` / `Valor indisponível`.

**Verified closing prices** (`docs/verified-closing-prices.md`)

- Outside a session (or when the current quote fails checks), lists and detail show the dated verified close with the label `Último fecho verificado · {data}`. Other price labels: `Cotação BODIVA`, `Referência BODIVA`, `Última cotação BODIVA`.
- A closing reference never authorises valuation, simulation, alerts or insights.
- Instruments without any verified close remain visible (unless matured bonds) with the price explicitly unavailable.
- Reasons shown when a price cannot be confirmed: `Sem negócios no histórico oficial disponível.`; `A proveniência do preço ainda não foi confirmada.`; `A fonte não respondeu à última verificação.`; `A resposta da fonte não confirmou um preço válido.`; `A fonte limitou os pedidos. Voltamos a tentar após a espera indicada.`; `O histórico oficial ainda não foi recolhido para este instrumento.`; `Ainda não foi possível confirmar um preço oficial.`; `A última consulta não trouxe novos preços oficiais.`
- When the indicator and session totals are unavailable, the overview shows the count of instruments with verified closes instead.

**The invest.ao Indicator.** A proprietary equal-weight composite, base 100, built from verified closes. Always labelled `Indicador invest.ao` and always accompanied by "not an official BODIVA index". When its base history is unverified it shows `Indicador indisponível` with an explanation.

**Caching and staleness.** Market snapshot cache max age 24 h (kept longer only for dated closing references). Cached current prices and session statistics are stripped when expired; dated closes survive. "Thin market" is a first-class case: no-trade sessions are valid, unchanged prices can be fresh, `1D` is disabled with zero trades, and empty movement categories have explicit copy.

**Data source statement shown to users.** `Dados oficiais de mercado publicados pela BODIVA.`; Settings disclaimer `As cotações podem estar atrasadas, ser corrigidas ou ficar indisponíveis. A informação não constitui uma recomendação de investimento.`


<!-- Part 02b — Asset details, Simulation, Alerts. Source: iOS snapshot origin/main 1.1.5. Paths are relative to the snapshot root. -->

> Conventions used in this part
> - Copy is quoted as `PT` (EN). Both come from `Invest.AO/Resources/Localizable.xcstrings` (source language `pt`; keys are either dotted identifiers such as `assetDetails.tab.overview` or the Portuguese sentence itself).
> - "Plus" / "Pro" gates are only enforced when the build has subscriptions enabled (`InvestAOSubscriptionsEnabled == "YES"`) **and** the server access snapshot says `enforcement_enabled`. Otherwise every Plus/Pro feature below is open (`SubscriptionStore.unlocksPlusFeatures` / `unlocksProFeatures`, `Invest.AO/Core/Subscriptions/SubscriptionStore.swift`).
> - All dates/times are rendered in the Luanda calendar (`Calendar.market`, time zone `Africa/Luanda`, Monday-first) and in the app locale (`pt_AO` or `en_AO`).
> - `UNVERIFIED` marks anything not confirmable from the code read.

### 2.7 Asset details

**Purpose.** The single instrument screen: current/last verified price, price chart with scrubbing, performance, session statistics, liquidity, market facts, issuer profile, dividends, financial reports, order book, plus the two instrument actions (compare, alerts) and watchlist/share/export. A second variant renders a *pre-admission listing* (an announced IPO/admission that has no tradable security yet).

**Files.** `Invest.AO/Features/AssetDetails/**`, `Core/Components/{PriceChart,ChartEndpoints,ChartShimmerView,TimeRangePicker}.swift`, `Core/Charts/ChartComparisonMath.swift`, `Core/Market/Domain/Models/{MarketSecurity,TimeRange,SecurityDetail,BondYield,IntradayChartSnapshot}.swift`, `Core/Market/Domain/{LiquidityProfile,PriceHistoryCSV}.swift`.

**Entry points.** Pushed as a navigation destination for a `MarketSecurity` from Home, Markets, Search, Watchlist, News article / market information, Activity Center, deep links (`App/ApplicationShell.swift`, `App/InvestAOApp.swift`) and from a Home listing highlight (`AssetDetailsView(listingEvent:)`).

**Gating summary.**

| Capability | Signed-out | Free | Plus | Pro |
|---|---|---|---|---|
| View price, chart 1D–1A, statistics, performance, market info, about, issuer, dividends, reports | yes | yes | yes | yes |
| Chart range `Tudo` (All) | paywall | paywall (`.history`) | yes | yes |
| Export price history CSV | paywall | paywall (`.priceExport`) | yes | yes |
| Liquidity section | locked button | locked button (`.liquidity`) | yes | yes |
| Order book | first 5 levels per side | first 5 levels per side | first 5 levels per side | full depth (`.orderBookDepth` is a **Pro** reason) |
| Comparison | needs account (server authorisation) | 2 instruments, 1 pair per Luanda week | 3 instruments, no weekly limit | same as Plus |
| Alerts | needs account | 2 alerts total | unlimited | unlimited |
| Watchlist star | needs account (rules in Watchlist part) | Free limit applies (Watchlist part) | yes | yes |

Locks are always presented the same way: the control stays visible, tapping it calls `subscriptions.requestUpgrade(reason)` which opens the paywall with a reason sentence; when the purchase is verified the blocked action resumes once.

#### Screen: Asset details (security)

Chrome
- Navigation bar, inline. **Principal item**: symbol (`.headline`) over display name (`.caption2`, one line). Tab bar is hidden on this screen.
- **Trailing toolbar**
  1. Share menu (icon `square.and.arrow.up`, label `Partilhar instrumento` (Share instrument)):
     - `Partilhar instrumento` — system share of text. With a price: `"{SYMBOL} — {price}, {±x,xx%} · {price label} na invest.ao"` (e.g. `BAI — 72 500,00 Kz, +1,30% · Cotação BODIVA na invest.ao`); without a price: `"{SYMBOL} — {name} na invest.ao"`. Subject: `"{SYMBOL} na invest.ao"`.
     - `Exportar histórico` (Export history), icon `tablecells` — only when the instrument has ≥ 2 daily history points. Plus: shares a CSV file; otherwise opens the paywall (`Exporte o histórico de preços em CSV com o Plus.`).
  2. Watchlist star (`star` / `star.fill`, accent colour). Toggles watchlist membership with a snappy 0.24 s animation and a selection haptic. When *adding*, the app immediately asks for notification permission and registers for push. Disabled until the snapshot is loaded. VoiceOver: `Adicionar à lista de acompanhamento` / `Remover da lista de acompanhamento`, value `Na lista` / `Fora da lista`.
- **Bottom action bar** (floating glass group, only once data is loaded). Two equal buttons, min height 44; stacked vertically at accessibility text sizes:
  - `Comparar` (Compare), glass style, chart icon → opens the comparison sheet.
  - Alert button, prominent glass style. Title/icon depend on this instrument's alerts: `Criar alerta` (Create alert, `bell`) when none; `1 alerta ativo` / `{n} alertas ativos` (`bell.badge`) when any is enabled; `1 alerta pausado` / `{n} alertas pausados` (`bell.slash`) when all are disabled → opens the alert sheet.
  - The bar shrinks to 84 % scale while the user scrolls down and returns when scrolling up or at top (`ScrollCompactState`, 12 pt direction threshold; disabled under Reduce Motion).

Body (vertical scroll, 20 pt side padding, 32 pt between blocks) in display order:

1. **Price hero** (`Components/AssetPriceHeader.swift`), centred
   - Logo circle 56 pt (remote issuer logo on white, or coloured initials fallback from `brandColor`).
   - Optional capsule badge over the bottom of the logo: `Novato` (Newcomer) — shown for 5 calendar days after a confirmed admission (`MarketListingPolicy.newcomerExpiration`), disappears automatically at expiry. VoiceOver: `Novato: admitido há menos de cinco dias`.
   - Display name (falls back to issuer name, then to the kind title when the name equals the symbol).
   - Row: kind label + market status indicator (7 pt dot + text). Kind labels: `Ação` (Stock), `Obrigação corporativa` (Corporate bond), `Obrigação do Tesouro` (Treasury bond), `Unidade de participação` (Fund unit), `Outro instrumento` (Another instrument). Status: `Aberto` (Open, green dot), `Em breve` (Coming soon, amber), `Fechado` (Closed, grey), `Indisponível` (Unavailable, grey).
   - **Price**: 44 pt semibold, tracking −1.5, monospaced digits, scales with Dynamic Type, numeric-roll transition on change.
   - Optional caption when the reference price update had an issue (`MarketPricePresentation.updateIssue`): `A última consulta não trouxe novos preços oficiais.` or `Atualização da referência: ` + reason sentence (table below).
   - **Change line** (semibold, coloured gain/loss/neutral):
     - normal: `{±amount} ({±pct%})`, e.g. `+931,09 Kz (+1,30%)`; bonds use percentage points for the amount: `+0,25 p.p. (+0,26%)`.
     - when only BODIVA's published percentage is available (intraday display price, no verified amount): percentage only (VoiceOver `Variação publicada pela BODIVA`).
     - while scrubbing the chart: price = the scrubbed point; change = scrubbed point vs the **first point of the selected range** (amount and %).
     - nothing is shown for a reference price (no movement is claimed for it).
   - **No displayable price**: title `Preço por confirmar` (Price unconfirmed), a reason sentence, and — when a verified close exists — caption `Último fecho verificado · {d MMM yyyy}: {price}`.

   Reason sentences (`Core/Formatting/MarketPricePresentation.swift`):

   | Server reason | Copy |
   |---|---|
   | `emptyHistory`, `no_official_history`, `empty_response` | `Sem negócios no histórico oficial disponível.` (No trades in the available official history.) |
   | `missingProvenance` | `A proveniência do preço ainda não foi confirmada.` |
   | `sourceUnavailable`, `timeout`, `source_failure` | `A fonte não respondeu à última verificação.` |
   | `invalidSource`, `invalid_response`, `symbol_mismatch`, `invalid_price`, `invalid_date` | `A resposta da fonte não confirmou um preço válido.` |
   | `rateLimited` | `A fonte limitou os pedidos. Voltamos a tentar após a espera indicada.` |
   | `notYetCollected` | `O histórico oficial ainda não foi recolhido para este instrumento.` |
   | anything else | `Ainda não foi possível confirmar um preço oficial.` |

2. **Chart section** (`Components/AssetChartSection.swift`) — shown when the instrument has daily history. Fixed height 258 pt.
   - *Chart type*: single line + soft area fill (series colour at 10 % opacity, filled down to the lowest value), **linear** interpolation, round caps/joins. No candles. Line width thins with range: 1D/1S 2.5, 1M 2.0, 3M 1.5, 6M 1.3, 1A 1.0, Tudo 0.6.
   - *Series colour*: green if the range ended above its start, red if below, accent (brand blue) if flat/unknown. For 1D it compares first vs last intraday point; other ranges use first vs last daily close in the window.
   - *Endpoints*: dots on the first and last real observation; their values are promoted to the trailing Y axis in the series colour (semibold) and nearby ordinary ticks are dropped (`ChartEndpointAxis`: ~4 "nice" steps, dashed grid `[3,4]`, labels in compact form with `k`/`M`/`B` suffix and 0–2 decimals).
   - *X axis*: label rules exist (`PriceChartXAxis`: `HH:mm` for 1D, capitalised weekday abbreviations one per day for 1S, `d MMM` ≤ 31 days, `MMM` ≤ 180 days, `MMM yy` ≤ 730 days, else year; max 4 labels) but the detail chart applies a trailing `.chartXAxis(.hidden)`; the older layout screenshot `docs/design-system/layouts/detail.jpg` also shows no X labels. Treat as **hidden on the detail chart** (`UNVERIFIED` on device). Both axes are removed at accessibility text sizes.
   - *Y domain*: min…max padded by `max(12 % of span, max(0.5 % of max, 1))`.
   - *Scrubbing*: touch-down anywhere (no minimum drag distance) snaps to the nearest observation; shows a dashed vertical rule (1 pt, `[3,3]`, secondary text colour) and a larger dot (size 72). The hero price/change follow. Releasing clears the selection. Selection updates are capped at 30 Hz and the selection haptic at one per 0.1 s (`ChartScrubPacer`).
   - *VoiceOver*: label `Histórico do preço`; value `Começou em {start} e terminou em {end}`; for 1D with candle data: `Às {HH:mm}, abertura …, máximo …, mínimo …, fecho …, volume …, {n} negócios`.
   - *Loading*: `ChartShimmerView` — a neutral placeholder zig-zag line drawn in over 0.8 s on a 1.6 s loop with caption `A carregar histórico`; static under Reduce Motion. It is explicitly a placeholder, never fake prices.
   - *Not enough data* (inside the chart frame, icon `chart.xyaxis.line`): 1D → `Sem negócios nesta sessão.` when the session status is `no_trades`, otherwise `Os dados desta sessão estão indisponíveis.`; other ranges (< 2 points) → `Sem dados suficientes para mostrar a evolução do preço.`
   - **Intraday status line** (only when 1D is selected and one of these is true):

     | Condition | Text | Extra |
     |---|---|---|
     | request failed or status `stale` | `Dados desatualizados` (amber) | bordered retry button `arrow.clockwise` (VoiceOver `Tentar carregar a sessão novamente`) |
     | status `no_trades` | `Sem negócios nesta sessão` | — |
     | source `trades` with exactly one point | `Um negócio disponível` | — |
     | no chart yet | `A carregar sessão…` | — |
     | source `trades` and at least one point | adds `O último negócio pode diferir da cotação publicada.` | — |

   - **Range picker** (`TimeRangePicker`): text chips, min 44×44, selected chip = accent text on soft-accent rounded rect; scrolls horizontally if it does not fit; selection haptic.

     | Chip (PT / EN) | Data used | Window | Availability rule |
     |---|---|---|---|
     | `1D` / `1D` | Intraday series from RPC `get_intraday_chart` (5-minute buckets with open/high/low/close, volume, trade count; `source` = `trades` or `observations`). A synthetic anchor at the previous close is prepended at session open. | today's Luanda session | Always listed first; **disabled when today is not a trading day**. If selected on a non-trading day the screen falls back to 1S. Reloaded on every quote refresh / return to foreground; otherwise cached 60 s. |
     | `1S` / `1W` | daily closes | last 7 days | whenever ≥ 2 daily points exist |
     | `1M` | daily closes | last 30 days | history span ≥ max(7, 90 % of window) days and ≥ 2 points inside the window |
     | `3M` | daily closes | last 90 days | same rule |
     | `6M` | daily closes | last 180 days | same rule |
     | `1A` / `1Y` | daily closes | last 365 days | same rule |
     | `Tudo` / `All` | daily closes | full history | ≥ 2 points; **Plus-gated** — a non-Plus tap opens the paywall (`Veja todo o histórico de preços com o Plus.`) and selects `Tudo` after upgrade |

     Default selection is 1D (falls back to 1S when 1D is not allowed). Daily history is fetched in full (paged 1000 rows) regardless of plan — the `Tudo` gate is presentation only. Daily history is considered fresh for 5 minutes.
   - *History failed*: a 258 pt placeholder titled `Histórico` with `Não foi possível carregar estes dados.` and `Tentar novamente`.
   - *History loaded but empty*: icon + `Histórico indisponível` (History unavailable) + `A última atualização foi {d MMMM, HH:mm}.`

3. **Section tabs** (`InvestSectionTabs`, text tabs with a 3 pt accent underline): `Visão geral` (Overview) · `Sobre` (About) · `Ordens` (Orders). Default: Overview.

**Tab "Visão geral" (Overview)** — in order:

- a. **`Rendimento fixo` (Fixed income)** — bonds only (`BondFactsSection.swift`). Label/value rows:
  - `Emitente` (Issuer)
  - `ISIN` (when known)
  - `Moeda` (Currency, default `AOA`)
  - `Vencimento indicado no código` (Maturity indicated in code): date `d MMMM yyyy` decoded from the BODIVA ticker, followed by the note `Data deduzida do código do instrumento. Confirma as condições e o estado atual na documentação do emitente.` — or `Vencimento`: `Não confirmado` when the ticker cannot be decoded.
  - `Cupão` (Coupon): `Não disponível`, or `{x,xx%} · {Anual|Semestral|Trimestral}` once the user saved terms in the calculator.
  - `Valor nominal` (Face value): always `Não disponível`.
  - `Rendibilidade até ao vencimento` (Yield to maturity) — tappable row with chevron; shows the computed yield or `Calcular` (Calculate) → opens the **yield calculator** sheet.
  - Disclaimer: `A cotação percentual não é o cupão nem a rendibilidade do investimento. A base de cotação e as condições contratuais precisam de confirmação na fonte. Um instrumento sem cotação não deve ser interpretado como vencido ou reembolsado.`
  - Ticker maturity decoding (`MarketDiscovery.swift`): 8 characters; chars 1–2 letters; chars 3–4 day; char 5 month letter `J F M A I U L G S O N D` = Jan…Dec; chars 6–7 two-digit year (20yy); char 8 letter/digit. A bond whose decoded maturity is before today is hidden from every non-search surface.
- b. **`Desempenho` (Performance)** — only when a price and history exist. Four metrics in a row (2-column grid at accessibility sizes): `1 semana`, `1 mês`, `6 meses`, `1 ano`. Value = (last − first) / first over that window of daily closes, signed `±x,xx%`, green/red/grey; `—` when the range is not available (same availability rule as the picker).
- c. **`Estatísticas` (Statistics)** — two-column grid of label/value cells (one column at accessibility sizes), 72 pt min height, hairline under each:

  | Label | Shown when | Format |
  |---|---|---|
  | `Preço` (Price) | a display price exists | instrument price format |
  | `Abertura` (Open) | usable current quote and value present | instrument price format |
  | `Máximo` (High) | same | same |
  | `Mínimo` (Low) | same | same |
  | `Volume` | always | grouped integer, or `Indisponível` without a usable quote |
  | `N.º de negócios` (Number of trades) | usable quote and value present | grouped integer |
  | `Capitalização` (Market cap) | usable quote and value present | compact currency, 1 decimal (e.g. `1,2 mil M Kz`) |
  | `Última data de verificação` (Last verification date) | always | abbreviated date + short time in Luanda; or `Data de verificação indisponível` |

  The same rows apply to every kind; bonds simply render prices as percentages. There is no P/E, EPS, 52-week range or beta.
- d. **`Liquidez` (Liquidity)** — only when history exists (`AssetLiquiditySection.swift`).
  - Not Plus: a single secondary button `Ver liquidez` (See liquidity) → paywall (`Veja a liquidez de cada título com o Plus.`).
  - Plus: a card with
    - `Sessões com negócios` (Sessions with trades): `{traded} de {20}`
    - `Valor médio por sessão` (Average value per session): AOA, 0 decimals — hidden for bonds
    - `Sessões para vender a sua posição` (Sessions to sell your position): `≈ {n}` or `—` — only for non-bonds when the user's portfolio transactions leave a positive quantity of this instrument; this cell is a sensitive value (masked in privacy mode).
  - Rules (`LiquidityProfile`): window = the last **20 market sessions** (dates taken from the market index history, ≤ today; falls back to the last 20 weekdays when fewer are known). Traded sessions = distinct days in the window with volume > 0. Average value = Σ(volume × close) ÷ 20 (sessions without trades count as zero). Sessions to exit = ⌈held quantity ÷ average daily volume⌉.
- e. **`Informação de mercado` (Market information)** — label/value list with hairlines: `Símbolo`, `ISIN` (second row, when known), `Tipo` (kind), `Emitente`, `Moeda` (default `AOA`), `Mercado` (default `BODIVA`), `Estado da negociação` (Trading status; coloured green/amber/grey).

**Tab "Sobre" (About)**

- **`Sobre`**: the instrument summary from the backend, or a generated sentence by kind:
  - stock: `{name} é uma ação emitida por {issuer} e admitida à negociação no mercado angolano.`
  - corporate bond: `{name} é uma obrigação emitida por {issuer} e negociada no mercado angolano.`
  - treasury bond: `{name} é uma obrigação emitida pela República de Angola e negociada no mercado angolano.`
  - fund: `{name} é uma unidade de participação negociada no mercado angolano.`
  - other: `{name} é um instrumento financeiro negociado no mercado angolano.`
- **Issuer block** — only for stocks, corporate bonds and funds (not treasury bonds / other). Header `Empresa` (Company) or, for funds, `Sociedade gestora` (Fund manager). Issuer description paragraph, then rows `Sector`, `Sede` (Headquarters), `Site` (Website — host without `www.`, accent colour with ↗; opens an in-app browser sheet).
- **Glass card** (20 pt radius) containing two sub-sections:
  - `Dividendos` (Dividends): grid cells `Por ação` (per share; currency, 2 decimals), `Dividend yield` (unsigned %; computed as dividend ÷ current price only with a usable quote, else `—`), `Ex-dividendo` (date), `Pagamento` (payment date), `Frequência`. Dates `d MMM yyyy`. Empty: `Ainda não existem dados de dividendos publicados para este título.` (The labels `Dividend yield`, `Ex-dividendo` and `Sector` are hard-coded literals in code.)
  - `Relatórios financeiros` (Financial reports): up to **3** most recent; each row = title, optional `{period} · {published date}`, trailing `Ver relatórios` ↗ → in-app browser. Empty: `Os relatórios financeiros mais recentes ainda não estão disponíveis.`
- Issuer, dividends and reports load independently; each shows its own skeleton placeholder or `Não foi possível carregar estes dados.` + `Tentar novamente`.

**Tab "Ordens" (Orders)** (`Components/AssetOrderBookSection.swift`)

- Loading / failed: placeholder titled `Livro de ordens` (skeleton, or failure text + retry).
- Available book: header `Livro de ordens` (Order book); caption `Melhores preços no topo · Todos os níveis` (Best prices first · All levels — shown even when depth is capped); row `Diferença compra/venda` (Bid/ask spread) = best ask − best bid; two side headings `Compra` (Buy, green) / `Venda` (Sell, red) each with `{n} nível|níveis`; then one row per rank pairing bid (right-aligned) and ask (left-aligned):
  - price (2 decimals, side colour, semibold), `Qtd. {quantity}` (0–4 decimals), `{n} ordem|ordens` when the order count is known;
  - a depth bar behind each cell: side colour at 12 % opacity, width = quantity ÷ the largest visible quantity (one scale for both sides); bid bars grow from the centre leftwards, ask bars from the centre rightwards;
  - `—` where one side has no level at that rank; cells stack vertically at accessibility sizes with their own side label.
  - Footnotes: `As barras comparam a quantidade em cada nível, na mesma escala para compra e venda.` and, if any level lacks a count, `O número de ordens não está disponível para todos os níveis.`
- **Depth cap**: without Pro only the first **5** levels per side are shown (`FreePlanLimits.orderBookLevels`), followed by a secondary button `Ver os {n} níveis` (See all {n} levels) → Pro paywall.
- **Availability rule**: the book is only shown while the instrument's market status is *open*, the session context has not expired and the order-book quality evidence is current. Otherwise (and when empty): `Não existem ordens verificadas disponíveis.` (No verified orders available.)
- Refresh: while the Orders tab is selected, the app is active and the market is open, the book is re-fetched every **60 s**.

Screen-level states

| State | Presentation |
|---|---|
| First load | Skeleton: three text bars, chart shimmer, pill, 4 metric blocks, 6 grid cells (VoiceOver `A carregar detalhes do título`) |
| Loaded, instrument not listed/visible (delisted, matured bond) | System empty view `Instrumento indisponível` |
| Market snapshot failed | Shared `LoadableContent` failure with retry (design-system part) |
| History / intraday request failed | Error toast with retry (`ChartErrorToastPresenter`) plus the inline placeholders above |
| Background refresh failed | Toast `Não foi possível atualizar os dados` / `Verifica a ligação à Internet e tenta novamente.` with `Tentar novamente`; suppressed for pure quote-transport failures, which are explained by the price/status copy instead |
| Offline / stale quote | Current price is withdrawn (never replaced by zero); the hero falls back to a verified close or reference, or to `Preço por confirmar`; history, statistics rows without live data, issuer info stay visible |
| Signed-out | Entire screen is readable. Alerts are only loaded for signed-in users. |

Data loading and refresh (behavioural contract)
- On appear / return to foreground: market snapshot → then in parallel daily history, issuer, reports, dividend and order book.
- After 3 s of viewing by a signed-in user, the app records an "asset viewed" personalisation signal and marks related Activity Center items as opened.
- Newcomer badge state re-evaluated every 60 s from the market-events feed.
- Returning to foreground clears any scrub selection.

**Price display policy on this screen** (from `MarketSecurity.swift`, `docs/current-quote-policy.md`, `docs/verified-closing-prices.md`; code and docs agree)

| Situation | Price shown | Label used in share text / widgets | Change shown |
|---|---|---|---|
| Open session, quote of today, quality + calendar evidence unexpired | live BODIVA quote | `Cotação BODIVA` (BODIVA quote) | BODIVA's reported % if present, else verified % |
| Market closed / opening soon and a verified close exists that is not older than the quote | verified closing price | `Último fecho BODIVA` (Last BODIVA close) | close's own % (amount derived from it); falls back to BODIVA's reported % for a same-session quote |
| Valid BODIVA reference price newer than any usable quote | reference price | `Referência BODIVA` (BODIVA reference) | none |
| Quote evidence expired but a dated source quote remains | last reported price | `Última cotação BODIVA` (Last BODIVA quote) | reported % if available |
| None of the above | `Preço por confirmar` + reason | — | — |

A closing/reference price never counts as a "usable quote": it cannot feed simulation, portfolio valuation, alerts logic, dividend yield, statistics rows gated on `hasUsableQuote`, or insights.

Number formats on this screen

| Value | Format (pt_AO examples) | Source |
|---|---|---|
| Equity / fund / other price | AOA currency, 2 decimals: `72 500,00 Kz` | `InvestNumberFormat.securityPrice` |
| Bond price | percentage of nominal, ≥ 2 decimals, unsigned: `98,50%` | same |
| Change amount | currency 2 decimals signed; bonds: `+0,25 p.p.` | `InvestNumberFormat.quoteChange` |
| Percent change | signed, 2 decimals: `+1,30%` | `InvestNumberFormat.percentage` |
| Quantity (order book) | 0–4 decimals, grouped | `InvestNumberFormat.quantity` |
| Chart axis | compact `k` / `M` / `B`, 0–2 decimals | `InvestNumberFormat.chartAxis` |
| Verified close label | `Último fecho verificado · d MMM yyyy` (always `pt_AO` date) | `VerifiedClosingPrice.label` |

#### Screen: Listing (pre-admission company page)

Used when the destination is a new-listing market event without a confirmed tradable security (`Components/AssetListingContent.swift`). As soon as the event is confirmed **and** the security resolves, the normal asset screen replaces it.

Navigation title `Empresa` (Company); star button appears only when the security already resolves. Sections in order:
1. Issuer identity: logo 64 pt (or initials), issuer name (large), `Nova admissão à BODIVA` (New BODIVA admission).
2. Admission card: label with calendar icon `Admissão prevista` (expected) or `Admissão confirmada` (confirmed); date `d MMMM` large with year below; divider; status title `A aguardar confirmação` / `Já faz parte do mercado`; message `A data está anunciada. A negociação será indicada após a confirmação da admissão.` / `A admissão foi confirmada. As cotações dependem dos dados de negociação disponíveis.`
3. `Sobre a empresa` (About the company) — issuer description, when provided.
4. Quote placeholder: `Cotações após a estreia` / `O preço e o histórico aparecem quando houver dados de negociação.`
5. `Informação oficial` (Official information): one external link row per source (source name, host, ↗).
6. Hint when no security exists yet: `Quando as ações estiverem disponíveis, poderás adicioná-las à tua lista de acompanhamento.`

The screen re-evaluates itself at the listing's time boundaries (start, scheduled day, day after, expiry) without a manual refresh.

#### Sheet: Bond yield calculator

`BondYieldCalculatorView.swift`, `Core/Market/Domain/Models/BondYield.swift`. Opened from the `Rendibilidade até ao vencimento` row. Form sheet titled with the bond symbol; leading close button; trailing confirm `Guardar cupão` (Save coupon; disabled until the coupon is valid).

Inputs
| Field | Default | Rules |
|---|---|---|
| `Preço (% do nominal)` (Price, % of nominal) | current price, up to 4 decimals, when > 0 | decimal comma; must be > 0 |
| `Cupão anual (%)` (Annual coupon) | previously saved value | 0 ≤ rate < 100 |
| `Pagamento` (Payments) picker | `Semestral`; options `Anual` (1), `Semestral` (2), `Trimestral` (4) | — |
| `Vencimento` (Maturity) | date decoded from the ticker (read-only), otherwise a date picker (today onward, default today + 2 years) | must be after today |

Outputs (shown once price and coupon are valid; otherwise `Indica o preço e o cupão`)
| Row | Meaning | Format |
|---|---|---|
| `Rendibilidade até ao vencimento` | YTM, annual, compounded at coupon frequency | unsigned %, 2 decimals, bold |
| `Rendimento corrente` (Current yield) | coupon rate ÷ clean price × 100 (only if coupon > 0) | unsigned % |
| `Juro corrido por 100` (Accrued interest per 100) | coupon per period × elapsed fraction of the period | 4 decimals |
| `Preço com juro corrido` (Dirty price) | clean + accrued | 4 decimals |
| `Próximo cupão` (Next coupon) | next coupon date | `d MMMM yyyy` |
| `Cupões por pagar` (Coupons remaining) | count | integer |

Calculation: coupon dates step back from maturity in whole months (12 ÷ frequency); day fraction = actual days to next coupon ÷ actual days in the period; price(y) = Σ cash-flowᵢ ÷ (1 + y/f)^(i + fraction) with redemption of 100 on the last flow; y solved by bisection (200 iterations) between −0.99·f and 1000 %; no result if the dirty price is outside that range. Settlement = today.

Persistence: only coupon rate + frequency are saved, **on the device only**, per security (`UserDefaults` key `investao.bondTerms`). BODIVA does not publish coupon terms, so the holder supplies them from the prospectus. Saved terms then feed the `Cupão` and yield rows of the bond facts section.

#### Sheet: Chart comparison

`ChartComparisonView/*.swift`, `Core/Charts/ChartComparisonMath.swift`. Full-height sheet opened from `Comparar`.

Layout (top to bottom)
1. Navigation bar: title `Comparar · {SYMBOL}`; leading close; trailing share icon (`Partilhar gráfico`) — disabled while exporting or when there is nothing to plot.
2. **Header**: a small caption — `Variação de preço no período comum` (Price change in the shared period) when a common interval exists, else `Variação de preço`; while scrubbing it shows the scrubbed time (`HH:mm` for 1D, otherwise `d MMMM yyyy`). Then one item per visible series: colour dot + symbol; large signed performance (`+0,40%`; exactly zero prints `0%`); price beneath (2 decimals). A mini spinner while that series loads; `Sem dados` when it has no value. Items scroll horizontally at accessibility sizes.
3. **Chart** (fills remaining height, min 220 pt): one line per visible instrument plotting **percentage change from a common baseline** (not price). Solid baseline rule at 0 %. Lines 1.5 pt, linear. The shared start is marked with a dot filled by an angular gradient of all visible series colours; each series' last point has a dot in its colour. Trailing Y axis in % (about 7 "nice" ticks, 1 decimal below 10 %, 0 decimals above; 0 % emphasised; ticks that coincide with a series' start/end take that series' colour). X-axis labels: 5 for 1D, 7 for 1S, 6 for 1M/3M, 7 for 6M/1A/Tudo — `HH:mm`, `d MMM` (≤ 45 days), `MMM` (≤ 400 days), else `MM/yyyy`; hidden at accessibility sizes. No legend (the chips are the legend).
4. **Range picker**: same chips as the detail chart; offered ranges = 1D + every range up to the longest available among the active instruments. `Tudo` is **not** Plus-gated here (the binding is not wrapped by the history gate). 1D disabled on non-trading days.
5. **Instrument chips** (horizontal scroll): the primary chip (checkbox + symbol + price; can be hidden, cannot be removed); one chip per added instrument (checkbox toggles visibility, `×` removes it); a `+ Comparar` chip while fewer than 2 instruments are added → opens the picker.

Series colours: primary = brand accent; 1st comparison = orange (light `#A34E00`, dark `#FF9400`); 2nd = purple (light `#7935B5`, dark `#AD52E0`).

Rules
- Maximum **2 added instruments** (3 lines). Only instruments of the **same kind** as the primary and with a chart reference price can be added.
- Plan limits (server-enforced through RPC `authorize_chart_comparison`, canonical instrument set): Free = 2 instruments in total and **one pair per Luanda calendar week** (reset Monday 00:00 Luanda; re-opening the same pair is free); Plus = up to 3 instruments, no weekly quota.
- Before spending a weekly pair the client loads the histories for the selected range and requires **two shared observations**; otherwise it shows an alert titled `Comparação` — `Não existem duas observações comuns neste período. Escolhe outro período ou instrumento. A comparação gratuita não foi utilizada.` — and nothing is consumed.
- Authorisation failures: size or weekly limit → the picker closes and the paywall opens (`O plano gratuito permite um par de 2 instrumentos por semana.`), resuming the add after upgrade; insufficient verified data → alert `Ainda não existem dados verificados suficientes para esta comparação. A tua comparação gratuita não foi utilizada.`; signed out → `Inicia sessão para utilizar a comparação semanal.`; any other failure → `Não foi possível confirmar a comparação. Tenta novamente com o mesmo par; a tentativa não gasta uma segunda comparação.`
- While authorising: the sheet is disabled, cannot be swiped away, and shows a spinner `A preparar comparação`.
- Math: daily ranges compare the **last observation of each shared market session**; 1D compares shared 5-minute buckets (observation-sourced series are bucketed to the last value per 5 minutes, never gap-filled). The common interval runs from the first to the last date present in *every visible* series inside the requested window and needs ≥ 2 such dates. Performance = (price ÷ price at interval start − 1) × 100. Hiding/showing a series recomputes the interval.
- Requested window: 1S = 7 days, 1M/3M/6M = calendar months, 1A = 1 year back from the latest observation; 1D and Tudo start at the oldest available point.
- Scrubbing: same gesture/pacing as the detail chart; snaps to the nearest date across visible series; a header item only shows values for a series that has an observation at exactly that date.
- Refresh: 1D series are re-requested every 60 s while the sheet is active; daily histories load on demand.
- Empty chart states: `Sem dados suficientes no mesmo período para comparar a variação de preço.` (series visible but no common interval) and `Seleciona pelo menos um instrumento para ver o gráfico.` (everything unchecked).
- Completing a valid comparison that the user interacted with, or successfully sharing one, counts as a completion moment for the in-app review prompt (`Core/Reviews/ComparisonReviewSession.swift`).
- When the build has subscriptions disabled, no authorisation call is made and two comparisons can be added freely.

**Instrument picker sheet** (`InstrumentPickerSheet.swift`; medium/large detents). Title `Comparar com` (Compare with); always-visible search field `Símbolo, nome ou emitente`. Rows: logo 40 pt, symbol + small kind label, name, trailing price and day % (green ≥ 0, red < 0), `plus.circle.fill`. Tapping adds and dismisses. Empty: `Sem instrumentos para comparar` / `Não existem outros instrumentos desta categoria com preços disponíveis.` No search match: shared search empty state (`Não encontrámos títulos para “{query}”.`).

**Share / story export** (`ChartComparisonExport.swift`, `ChartStoryExportView.swift`). Renders a fixed 540 × 960 pt canvas at 3× → **1620 × 2880 PNG** (9:16 story format), in the user's current light/dark scheme, and opens the system share sheet with the file. Canvas content, top to bottom:
1. Brand row: three overlapping accent circles + `invest.ao`; trailing `Comparação`.
2. Title `Variação de preço` (38 pt), range pill (`1 dia`, `1 semana`, `1 mês`, `3 meses`, `6 meses`, `1 ano`; the `Tudo` range prints `Máximo`), the data date range, and `Mesma base de partida · 0% · Cotações no fim do período`.
3. The comparison chart (320 pt tall, 250 pt with three series): 2 pt lines, first/last dots, 3 X labels (first/middle/last), ≤ 5 Y ticks + 0 %.
4. Results list: per series colour dot, symbol, name, large coloured performance, price.
5. Footer: coverage sentence `{Sessões comuns | Intervalos comuns de 5 min}: {start} — {end}. Variação de preço, sem dividendos, comissões ou impostos.` (or, with no common interval, `Não existem duas observações comuns no período pedido. Altera o período ou os instrumentos.`), then `O teu mercado, de perto.` and `invest.ao`.
Failure to render/write shows an action error toast with retry.

Not shipped: `ComparisonDataSheet.swift` (`Dados do gráfico` — a per-observation table with first/last observation, quote and change vs baseline, and the note `Cotações disponíveis na invest.ao. As linhas ligam observações; não representam negociações entre esses pontos. Horas de Luanda.`) is defined but **never presented** in 1.1.5.

#### Export: price history CSV

`Core/Market/Domain/PriceHistoryCSV.swift`. File name `invest-ao-{symbol-lowercase}-historico.csv`. Semicolon-separated, CRLF line endings, decimal comma, no grouping, up to 8 decimals. Header `data;fecho;abertura;maximo;minimo;volume;negocios`; date `YYYY-MM-DD` (Luanda day); one row per daily close, oldest first; missing values are empty cells (the trade-count column is empty for daily history, which is fetched without it).

#### Doc vs code notes (asset details)

- `docs/design-system/layouts/detail.jpg`, `comparison.jpg`, `picker.jpg` are older than the code: they show an inline "1 alerta neste instrumento" summary card on the detail screen and a `Variação do preço / Preço` segmented control plus an on-screen coverage caption in comparison. In 1.1.5 the alert summary lives in the bottom bar button, comparison plots percentage change only, and the coverage caption appears only in the exported image.
- `docs/UX_AUDIT_MOBBIN.md` describes Catmull–Rom interpolation; current charts use linear interpolation (consistent with `docs/UI_REFINEMENTS.md`: endpoint dots + Y-axis endpoint values).
- `docs/subscription-rollout-1.1.1.md` / `docs/subscription-foundation.md` match the comparison limits above.

---

### 2.8 Investment simulator

**Purpose.** A hypothetical projection: "if I put X now and Y per month into this instrument and its price changed Z % a year, what would I have after N months?" It uses the instrument's latest server quote to size unit purchases and a user-entered assumption for growth. It never saves a trade, never touches the portfolio, and no entered value is sent to analytics (`docs/investment-simulator.md`, consistent with code).

**Files.** `Invest.AO/Features/Simulation/**`, `Core/Formatting/SimulationNumberParser.swift`, `Core/Formatting/AngolanAmountEditing.swift`, `Core/Components/AngolanAmountField.swift`.

**Entry points.** A full-width action row `Simular investimento` (Simulate investment) with subtitle `Define um cenário e explora a evolução do teu investimento.` and chart icon, on Home (also visible while Home is still loading) and on Portfolio (dashboard and empty state). It pushes onto the current navigation stack; there is no tab. Tab bar hidden; inline title `Simular investimento`.

**Gating.** Requires a signed-in account. **No subscription tier check** exists in the feature. Signed-out users see `Inicie sessão para simular investimentos.` above the standard sign-in screen embedded in place; signing in continues into the simulator. Any account change resets the draft.

#### Screen states before the calculator

| State | Presentation |
|---|---|
| Loading quotes | Title `Preparar simulação`; `A consultar a cotação mais recente para o teu cenário.`; card with spinner `A obter cotações`; caption `A simulação usa a cotação disponível no servidor. Pode demorar alguns instantes.` |
| Request failed | Empty-state view, icon `wifi.exclamationmark`: `Cotações indisponíveis` + the mapped error message + ` Voltamos a tentar automaticamente.`; prominent button `Tentar novamente`. Auth failures omit the auto-retry sentence and stop retrying. |
| No eligible instrument | Icon `chart.xyaxis.line`: `Sem cotações atuais para simular` / `Não existem ações ou unidades de participação em AOA com uma cotação válida neste momento. Voltamos a tentar automaticamente.` + `Tentar novamente` |

Data rules
- Every entry and every scene-phase change triggers a **fresh authenticated snapshot**; there is no cached fallback and no public fallback (`MarketStore.fetchSimulationSnapshot`).
- While the screen is open the request loop repeats every 30 s after a success or first failure and every 60 s after repeated failures, without clearing the draft.
- Eligible instruments: kind stock or fund, usable current quote (see price policy above), finite price > 0, currency exactly `AOA`. **Bonds are excluded.** Sorted by symbol.
- Quotes expire on their own deadline even between requests; an expired instrument drops out of the picker and the selected one becomes invalid.

#### Screen: Simulator (projection first, controls after)

`InvestmentSimulationView.swift`. One scroll view, in order:

1. **Instrument header**
   - Nothing selected: one primary button `Escolher instrumento` (Choose instrument, magnifier icon).
   - Selected: a tappable block — symbol (section-title weight) over name, with an up/down chevron — and, trailing, the quote in AOA with 2 decimals (VoiceOver `Última cotação disponível`). Tapping opens the picker.
   - If a previously selected instrument is no longer usable: red inline label `Seleccione um activo com cotação disponível.` (or `Este activo não tem uma cotação válida para simular.` / `A simulação está disponível apenas para activos cotados em AOA.`).
2. **Projection headline**
   - Small line: `Em {horizon}` (e.g. `Em 5 anos`, `Em 18 meses`); `Hoje` when scrubbing month 0; `Valor estimado` when nothing can be computed.
   - Big value (44 pt, numeric-roll): estimated value at the horizon, or at the scrubbed month. Placeholder `— Kz` when inputs are invalid/incomplete.
   - Metrics line (wraps to two lines if needed): gain `{±amount} ({±pct})` in green/red/grey — percent = gain ÷ total contributed, 0–1 decimals — and `de {total} investidos` (of {total} invested).
3. **Chart** (200 pt, only with a valid result): projected value as a 2.5 pt accent line with a top-to-transparent gradient area (monotone smoothing) over a dashed grey line of cumulative contributions. X axis shows only `Hoje` (left) and the horizon label (right); Y axis hidden. Dragging selects a month (rule + dot) and the headline follows; releasing returns to the horizon; selection haptic per month. Legend: `Valor projectado` (solid) · `Investido` (dashed). VoiceOver summary: `Ao fim de {n} meses, o total disponibilizado é {x} e o valor projectado, incluindo o saldo não aplicado, é {y}.`
4. **Scenario controls** — four rows separated by hairlines; each row = title, right-aligned editable value (22 pt semibold, accent; red when invalid), unit, then a horizontally scrolling line of preset capsules (selected preset = accent on soft-accent):

   | Row (PT / EN) | Unit | Default | Presets | Keyboard |
   |---|---|---|---|---|
   | `Investimento inicial` / Initial investment | `Kz` | empty | 50 000 · 100 000 · 500 000 · 1 000 000 (shown in compact notation) | decimal pad, live grouping |
   | `Reforço mensal` / Monthly contribution | `Kz` | `0` | 0 · 10 000 · 25 000 · 50 000 | decimal pad, live grouping |
   | `Prazo` / Duration | `meses` | `60` | 12 · 36 · 60 · 120 · 240, labelled `1 ano`, `3 anos`, `5 anos`, `10 anos`, `20 anos` | number pad |
   | `Variação anual do preço` / Annual price change | `%` | `0` | −10 % · 0 % · +5 % · +10 % · +15 % | numbers & punctuation (allows minus) |

   - Focusing a field selects its whole content so typing replaces it. A keyboard toolbar offers `Concluído` (Done).
   - Field errors appear under the row once the field has content or has been visited.
5. **Simulated position** (only with a valid result) — label/value rows: `Unidades iniciais` (Initial units), `Unidades no final` (Final units), `Preço final hipotético · {SYMBOL}` (Hypothetical final price), `Saldo não aplicado` (Uninvested balance). Quantities print up to 10 significant digits; money in AOA with 2 decimals.
6. **Quote footnote** (caption text + a glass refresh icon button `Actualizar cotações` when an instrument is selected):
   - `Última verificação: {date time}` or `Hora da verificação indisponível`
   - `Último negócio: {date time}` or `Data do último negócio indisponível`
   - when some stock/fund instruments lack a current quote: `Alguns instrumentos não têm cotação atual e estão temporariamente indisponíveis para simular.`
   - always: `Cotação consultada no servidor. Não é um preço de execução garantido.`
7. **`Como calculamos` (How we calculate)** — collapsed disclosure with four paragraphs:
   - `A cotação consultada no servidor determina quantas unidades pode adquirir. A variação anual do preço que introduz é uma hipótese, convertida numa taxa mensal equivalente e mantida durante todo o prazo. Não a inferimos do desempenho passado.`
   - `Os reforços entram no final de cada mês e compram unidades ao preço projectado desse mês. Para acções, compramos unidades inteiras; nos fundos, admitimos unidades fraccionadas. O saldo não aplicado fica disponível para o próximo reforço.`
   - `O valor final inclui as unidades projectadas e o saldo não aplicado. Não incluímos dividendos, impostos, comissões ou inflação. Obrigações não estão disponíveis porque a cotação percentual exige dados adicionais para calcular o seu valor monetário.`
   - `Limites: valores até 1 bilião Kz por campo, prazo de 1 a 600 meses e taxa anual superior a −100% e até 100%.`

**Instrument picker sheet** (`SimulationInstrumentPicker.swift`; medium/large detents) — deliberately identical in feel to the comparison picker. Title `Escolher instrumento`; search `Símbolo, nome ou emitente`; rows: logo 40 pt, symbol + kind label, name, price + day %, and a selection mark (`checkmark.circle.fill` accent for the current one, hollow circle otherwise). Selecting closes the sheet. The picker closes itself whenever quotes are refreshed or a request fails.

#### Calculation contract (`Models/InvestmentSimulation.swift`)

- Monthly growth factor g = exp(ln(1 + r) ÷ 12) for annual assumption r (0 % → 1).
- Month 0: buy units with the initial amount at the fetched quote — **whole units for stocks** (rounded down), **fractional units for funds**; the remainder is kept as cash.
- Each month 1…N: price ← price × g; budget = retained cash + monthly contribution; buy units at the new price (same whole/fractional rule); remainder stays as cash earning nothing.
- Value at any month = units × projected price + cash. Total contributed = initial + months × monthly. Gain = value − total contributed.
- All money maths in exact decimals with no monthly currency rounding; rounding happens only when formatting. Scenarios that cannot be represented fail visibly: `A projecção excede a precisão disponível. Ajuste a taxa ou o prazo.` (or `Não foi possível calcular a projecção com estes valores.`).
- Dividends, taxes, fees and inflation are excluded. The rate is always a user assumption (default 0 %, shown explicitly), never derived from history.

Validation

| Field | Rule | Message |
|---|---|---|
| any | empty | `Preencha este campo.` |
| any numeric | not a valid pt number | `Introduza um número válido. Use vírgula para os decimais.` |
| amounts | 0 … 1 000 000 000 000 Kz | `Introduza um valor entre 0 e 1 000 000 000 000 Kz.` |
| annual change | > −100 % and ≤ 100 % | `Introduza uma taxa superior a −100% e até 100%.` |
| duration | whole number | `Introduza um prazo em meses inteiros.` |
| duration | 1 … 600 | `Introduza um prazo entre 1 e 600 meses.` |

Any invalid or missing input hides the chart and position rows and shows the `— Kz` placeholder.

Number input rules (shared with alerts and the bond calculator)
- Parser (`SimulationNumberParser`): comma is the decimal separator; thousands may be grouped with dots **or** spaces (consistently); optional sign; no currency prefix; at most 38 significant digits.
- Amount field (`AngolanAmountField` + `AngolanAmountEditing`): decimal pad; regroups thousands with non-breaking spaces while typing without moving the caret; a typed `.` becomes `,`; backspacing a group space deletes the digit before it; on blur the value is normalised to at least 2 decimals (`50 000,00`); shrinks to fit (min 65 % size); has its own `Concluído` accessory button.

Persistence: the draft (four fields + selected instrument) lives in memory for the signed-in session and is shared between the Home and Portfolio entry points' owners; it is cleared when the account changes.

Doc vs code: `docs/investment-simulator.md` matches the implementation. Two small differences: the code additionally re-polls quotes every 30 s while the screen is open (doc only mentions entry and foreground return), and `docs/design-system/layouts/simulation.jpg` shows an earlier layout (hero `O teu próximo investimento`, `Usar valores ilustrativos`) that no longer exists — `SimulationDraft.example` is only used by the debug design gallery.

---

### 2.9 Alerts (per-instrument notification rules)

**Purpose.** Let a signed-in user create rules on one instrument that produce push notifications and Activity Center entries when a condition is met, and control "automatic movement" notifications for watched instruments.

**Files.** `Invest.AO/Features/Alerts/**`, `Core/Formatting/MarketNotificationPresentation.swift` (kind titles, threshold text), `Features/Notifications/Data/MovementAlertPreferences.swift` (automatic movements), `Core/Components/AlertSuccessSound.swift`.

**Entry points.** The alert button in the asset-details bottom bar and the alert action on a Watchlist row; both present the same sheet (`MarketAlertSheet`). There is no global "all my alerts" screen in this slice — alerts are always managed per instrument. (`Features/Watchlist/WatchlistAlertView.swift` and `MarketAlertConfiguration` are an older per-watchlist alert form that nothing presents in 1.1.5.)

**Gating.** Requires an account (rules are stored per user in `notification_rules`; signed-out requests fail with the standard sign-in error toast `Inicia sessão` / `Inicia sessão para continuar.` — exact signed-out flow `UNVERIFIED`). Free plan: **2 alerts in total across all instruments**; creating a third opens the paywall (`Crie mais de 2 alertas com o Plus.`) and resumes the save after upgrade. Editing, pausing and deleting are never limited. Plus/Pro: unlimited.

#### Sheet: Alerts for an instrument (management)

Large sheet with drag indicator; title `Alertas` (Alerts); leading close button. If the user has **no** alert on this instrument, the sheet jumps straight to the editor once alerts have loaded.

Sections in order
1. **Instrument header** (no card): logo 44 pt, symbol, name (2 lines max); trailing current price and a percentage-change capsule (arrow up-right / down-right / minus + `±x,xx%`, tinted background).
2. **Alert list**
   - Loading: spinner `A carregar alertas`.
   - Empty: system empty view `Ainda não tens alertas` (No alerts yet), bell icon.
   - Otherwise a grouped section `Os teus alertas` (Your alerts), newest first. Row: circular icon for the kind (accent on soft accent when enabled, grey when paused), **threshold** as the title, kind name as caption, and a switch.
     - Tap row → edit. Switch → enable / pause immediately. Swipe left → `Apagar` (Delete). Long-press menu → `Editar`, `Apagar`.
     - The threshold is a *sensitive value*: masked when privacy mode is on (VoiceOver reads the hidden label instead).
     - A row is disabled while its change is being saved.
3. **`Movimentos automáticos` (Automatic movements)** switch (waveform icon) — only when the instrument is on the user's watchlist. Controls whether the backend sends automatic significant-movement notifications for this watched instrument (default on). Turning it on also requests notification permission. Free plan allows this for **1 instrument**: the server rejects a second (`FREE_MOVEMENT_LIMIT`), the switch snaps back, a red footer shows `O plano gratuito permite movimentos automáticos de 1 instrumento. Escolhe o instrumento nas definições do plano ou utiliza o Plus.` and the paywall opens. Other failures: `Não foi possível guardar esta opção. Tenta novamente.` / `Não foi possível carregar os avisos automáticos.`
4. **Top banner** after a save: green check + `Alerta criado` (Alert created) or `Alerta atualizado` (Alert updated).
5. **Bottom bar**: primary button `Novo alerta` (New alert, plus icon).

Load failure: error toast with retry. All create/update/delete operations are optimistic with rollback and a retryable error toast.

#### Screen: Alert editor (pushed inside the sheet)

Title `Novo alerta` (New alert) or `Editar alerta` (Edit alert). Content in order:
1. Instrument header (as above).
2. `Tipo de alerta` (Alert type) — a menu picker listing all seven kinds with their icons.
3. The trigger sentence for the chosen kind, then (for kinds with a value) a large value field with its unit on the baseline. Monetary thresholds use the 44 pt grouped amount field; other kinds use a plain decimal field in the 44 pt headline style.
4. For monetary thresholds only: a live distance line — `{x,x%} acima do preço atual` (above current price), `{x,x%} abaixo do preço atual` (below), or `Igual ao preço atual` (within 0.05 %).
5. For monetary thresholds with a current price: four capsule shortcuts `−10%`, `−5%`, `+5%`, `+10%`. Tapping one sets the value to price × (1 ± step), rounded to 2 decimals, **and switches the kind** to "price below" (negative steps) or "price above" (positive steps).
6. If notifications are denied at OS level: an amber link `Ativar notificações` (Enable notifications, warning icon) that opens the app's notification settings.
7. Bottom primary button `Criar alerta` (Create alert) / `Guardar alterações` (Save changes); hidden while a keyboard is up (keyboard toolbar has `Concluído`); shows a spinner while saving; disabled until the value is valid. The back button is hidden and the sheet cannot be dismissed while saving.

Rule kinds

| Kind (code / server value) | Title in lists (PT / EN) | Trigger sentence in editor | Icon | Unit | Default | Accepted values | Threshold shown in list |
|---|---|---|---|---|---|---|---|
| `priceAbove` / `price_above` | `Preço acima de` / Price above | `Avisar-me quando o preço atingir` (Notify me when the price reaches) | `arrow.up.right` | `Kz` (or currency code); `%` for bonds | — | > 0 | AOA currency 2–8 decimals; bonds `x,xx%` |
| `priceBelow` / `price_below` | `Preço abaixo de` / Price below | `Avisar-me quando o preço baixar para` (…falls to) | `arrow.down.right` | same | — | > 0 | same |
| `movementAbove` / `percent_change_above` | `Variação superior a` / Change above | `Avisar-me quando a variação superar` (…the change exceeds) | `plus.forwardslash.minus` | `%` | — | > 0 | `x%` (0–8 decimals) |
| `high52Week` / `high_52w` | `Máximo de 52 semanas` / 52-week high | `Avisar quando atingir um novo máximo de 52 semanas` | `arrow.up.to.line` | none (no field) | fixed 1 | exactly 1 | the kind title |
| `low52Week` / `low_52w` | `Mínimo de 52 semanas` / 52-week low | `Avisar quando atingir um novo mínimo de 52 semanas` | `arrow.down.to.line` | none (no field) | fixed 1 | exactly 1 | the kind title |
| `volumeAboveAverage` / `volume_above_average` | `Volume acima da média` / Volume above average | `Avisar quando o volume do dia superar a média em` | `chart.bar.fill` | `×` | 2 | 1.5 … 20 | `x×` (0–2 decimals) |
| `daysWithoutTrades` / `days_without_trades` | `Dias sem negócios` / Days without trades | `Avisar quando ficar sem negócios durante` | `moon.zzz` | `dias` | 7 | whole number, 1 … 365 | `{n} dias` |

Common validation: threshold > 0, < 10¹⁶, at most 8 decimal places (matches the server column `numeric(24,8)`). Switching to a kind with a default pre-fills it; switching from a defaulted kind to a free-value kind clears the field. For bonds, price thresholds are percentages of nominal (plain decimal field, unit `%`, no ±% shortcuts and no distance line).

Lifecycle and feedback
- States are only **enabled** and **paused** (`is_enabled`). The client has no "triggered/consumed" state — a rule remains in the list after it fires; whether the server re-arms or rate-limits a fired rule is `UNVERIFIED` in this slice.
- A paused/expired-plan account keeps its rules (they are not deleted client-side).
- On a successful create or update: success haptic, a short bundled confirmation sound (`alert-success.wav`, played as a system sound so it follows the device's silent/sound settings), a VoiceOver announcement of the banner text, return to the list, and then a request for notification permission + push registration. A *create* (not an edit) also registers a completion moment for the in-app review prompt, deferred until the permission request has finished.
- Notification body templates produced for these rules: `{SYMBOL} atingiu o limiar de {threshold}.` (title `Preço alvo atingido`), `{SYMBOL} atingiu um máximo de 52 semanas.`, `{SYMBOL} atingiu um mínimo de 52 semanas.`, `{SYMBOL} negociou {n}× ou mais o volume médio.`, `{SYMBOL} está há {n} dias sem negócios.` (presentation and delivery are covered in the notifications part).

Doc vs code: `docs/design-system/layouts/alert.jpg` shows an earlier single-screen design (three radio options, an "Entrega de notificações" paragraph, "Alertas criados" list). 1.1.5 has seven kinds in a menu picker, a list-first sheet with a pushed editor, and no delivery paragraph.

---

#### Parity items (this slice)

Asset details
- View an instrument's current / last verified price with source-aware labelling and "price unconfirmed" reasons — `core`
- Day change as amount + percent, gain/loss colouring, bonds in percentage points — `core`
- Market status indicator (open / coming soon / closed / unavailable) on the instrument — `core`
- Interactive price chart with ranges 1D, 1S, 1M, 3M, 6M, 1A — `core`
- Chart scrubbing that drives the header price and change vs range start — `core`
- Intraday (1D) 5-minute chart with previous-close anchor, disabled on non-trading days, stale/no-trades/one-trade notices and retry — `standard`
- Full-history range `Tudo`, Plus-gated — `standard`
- Endpoint dots with endpoint values on the Y axis; compact axis numbers — `standard`
- Chart loading placeholder that never fakes data; empty/failed history states with retry — `standard`
- Section tabs Overview / About / Orders — `standard`
- Performance row (1 week, 1 month, 6 months, 1 year) — `standard`
- Statistics grid (price, open, high, low, volume, trades, market cap, last verification date) — `core`
- Liquidity section (traded sessions of 20, average value per session, sessions to exit own position), Plus-gated — `standard`
- Market information list (symbol, ISIN, type, issuer, currency, market, trading status) — `standard`
- About text with per-kind fallback sentence — `standard`
- Issuer profile (description, sector, headquarters, website in in-app browser) — `standard`
- Dividends block (per share, yield, ex-date, payment date, frequency) — `standard`
- Financial reports list (latest 3, opens in in-app browser) — `standard`
- Order book with paired bid/ask levels, spread, depth bars, order counts; only during an open session — `standard`
- Order book depth cap of 5 levels with Pro unlock — `standard`
- Order book auto-refresh every 60 s while visible and market open — `standard`
- Bond facts section (issuer, ISIN, currency, maturity decoded from ticker, coupon, disclaimer) — `standard`
- Bond yield-to-maturity calculator with locally saved coupon terms — `standard`
- "Novato" badge for 5 days after admission — `standard`
- Pre-admission listing page (expected/confirmed admission, company description, official sources) — `standard`
- Watchlist toggle from the instrument screen, with notification-permission prompt on add — `core`
- Share instrument as text — `standard`
- Export price history as CSV, Plus-gated — `standard`
- Bottom action bar (Compare + alert status button) that compacts on scroll — `platform-specific` (Liquid Glass bar; needs a Material/web equivalent such as a bottom app bar or sticky footer)
- In-app browser sheet for issuer links — `platform-specific` (SFSafariViewController → Custom Tabs / new tab)
- Selection haptics on scrub, range change and watchlist toggle — `platform-specific`

Comparison
- Compare an instrument with up to two others of the same kind as percentage change from a common start — `standard`
- Common-interval rule (two shared sessions / 5-minute buckets) with explanatory empty states — `standard`
- Show/hide and remove series via chips; add via searchable picker — `standard`
- Range picker in comparison including 1D — `standard`
- Scrub comparison chart with per-series values at exact observations — `standard`
- Free limit: one pair of 2 instruments per Luanda week, server-authorised, no spend on missing data; Plus: 3 instruments, no weekly limit — `standard`
- Share comparison as a 9:16 branded image (1620 × 2880) through the system share sheet — `standard` (rendering/share mechanism is `platform-specific`)
- Review-prompt trigger after a completed or shared comparison — `platform-specific`

Simulator
- Entry rows on Home and Portfolio — `standard`
- Sign-in requirement with inline sign-in — `standard`
- Fresh authenticated quote fetch with loading, failure, empty states and automatic retry — `standard`
- Instrument picker limited to AOA stocks and funds with a current quote — `standard`
- Four scenario inputs with presets (initial amount, monthly contribution, duration, annual price change) — `standard`
- Live projection headline (value, gain/loss with %, total invested) — `standard`
- Projection chart (value vs contributions) with month scrubbing — `standard`
- Simulated position details (initial/final units, hypothetical final price, uninvested cash) — `standard`
- Whole-unit (stocks) vs fractional (funds) purchase rule and retained cash — `standard`
- Quote freshness footnote with manual refresh and non-execution disclaimer — `standard`
- "How we calculate" methodology disclosure with limits — `standard`
- Portuguese number entry (decimal comma, live thousands grouping, strict validation messages) — `standard`
- Draft kept for the session and cleared on account change — `standard`

Alerts
- Create a price-above / price-below alert on an instrument — `core`
- Create a percent-change alert — `standard`
- Create 52-week high / low alerts — `standard`
- Create volume-above-average alert (1.5×–20×) — `standard`
- Create days-without-trades alert (1–365 days) — `standard`
- Quick ±5 % / ±10 % shortcuts and distance-from-current-price hint — `standard`
- List, edit, pause/resume and delete alerts per instrument — `core`
- Alert count / paused state reflected on the instrument's alert button — `standard`
- Free limit of 2 alerts with paywall and resume — `standard`
- Automatic-movement toggle per watched instrument with Free limit of 1 — `standard`
- Thresholds masked in privacy mode — `standard`
- Notification-permission prompt after saving and "enable notifications" link when denied — `platform-specific` (Android 13+ runtime permission / web push permission)
- Success haptic, confirmation sound and accessibility announcement on save — `platform-specific`
- Review-prompt trigger after creating an alert — `platform-specific`

<!-- Part 02c — Portfolio, Watchlist, shared facts/insights rules. Source: iOS snapshot origin/main 1.1.5. Paths are relative to the snapshot root. -->

> Conventions used in this part. Copy is quoted as `PT` (EN). Most strings here are dotted keys in `Invest.AO/Resources/Localizable.xcstrings` (e.g. `portfolio.emptyState.title`), a minority are Portuguese literals used directly as keys. "Kz" = AOA. All civil dates are Luanda days (`Calendar.market`, `Africa/Luanda`, `Core/Market/Domain/Models/MarketSnapshot.swift:265`). "Plus"/"Pro" gating follows `SubscriptionStore.unlocksPlusFeatures` / `unlocksProFeatures`: **both return `true` (feature open to everyone) unless the build has subscriptions enabled AND the server says enforcement is on** (`Core/Subscriptions/SubscriptionStore.swift:108-123`). So every "Plus"/"Pro" lock below only materialises once enforcement is live; the backend independently rejects gated writes (`PLUS_REQUIRED`, `PRO_REQUIRED`, `FREE_WATCHLIST_LIMIT`).

### 2.C1 Portfolio (`Carteira`)

**Purpose.** A manual investment ledger. The user records purchases, sales and income (dividends/coupons) by hand; the app values open positions with BODIVA quotes and shows value, cost, gain/loss, allocation, cash, benchmark comparison, yearly realised results, an income calendar and a small "weekly reading" of verified facts. There is **no broker connection**: `Os investimentos são adicionados manualmente. A invest.ao não tem acesso à tua conta bancária ou corretora.` (Investments are added manually. invest.ao cannot access your bank or brokerage account.)

**Where it lives.** Third tab, title `Carteira` (Portfolio) (`App/ApplicationShell.swift:100-103`). Files: `Invest.AO/Features/Portfolio/**`.

**Auth.** Signed-in only. Signed-out users see the authentication screen inside the tab instead of the portfolio (`ApplicationShell.swift:101`). There is **no local/offline/signed-out ledger and no migration on sign-in**: the ledger, named portfolios and cash movements live on the server per account (`SupabasePortfolioRepository`, `SupabasePortfolioBookRepository`, `SupabasePortfolioCashRepository`, wired in `App/InvestAOApp.swift:63-68`). On sign-out / account switch the in-memory store is reset (`PortfolioStore.reset()`), including the selected portfolio.

**Stored on device only (not synced):** selected portfolio (`investao.portfolio.selection`), income-reminder toggle (`investao.income.reminders`), per-bond coupon terms (`investao.bondTerms`, entered on the bond's asset page), privacy-mode flag, the one-per-account "saved reading" cache for insights.

#### Supported instruments and units

| Kind | Allowed in ledger | Quantity unit | Fractional quantity | Price unit | Value formula |
| --- | --- | --- | --- | --- | --- |
| Equity (`equity`) | yes | shares (`ações`) | **no — whole numbers only** | Kz per share | qty × price |
| Fund (`fund`) | yes | units (`unidades`) | yes | Kz per unit | qty × price |
| Treasury / corporate bond | yes | **nominal amount in Kz** | yes | **% of nominal** | nominal × price × 0.01 |
| Other kinds | no | — | — | — | — |

Source: `Features/Portfolio/Data/PortfolioTransaction.swift:137-162`. Only AOA-denominated instruments can be imported by CSV (`PortfolioCSV.parse`). Bonds are allowed in the ledger and dashboard but are **excluded from portfolio insights** (see 2.C1.14).

#### 2.C1.1 Tab root — states (`PortfolioView.swift`)

Evaluated in this order:

| # | Condition | What the user sees |
| --- | --- | --- |
| 1 | Ledger loaded, no open positions, but a weekly-reading insight is still visible | Scroll view with the insight block(s) for tabs 0 and 1 and a small text button `Atualizar carteira` (Refresh portfolio). Edge case (e.g. everything sold after the reading was generated). |
| 2 | Not loaded yet and no error | **Skeleton** mirroring the dashboard: summary block (4 bars), 180-pt chart block + range bar, 52-pt button bar, 44-pt tab bar, 4 instrument-row skeletons. Scroll disabled; VoiceOver label `A carregar carteira` (Loading portfolio). (`PortfolioLoadingView.swift`) |
| 3 | Load error and no positions | Full-screen error state with retry (shared `ErrorStateView`). |
| 4 | Loaded, no open positions | **Empty state** (below). |
| 5 | Otherwise | **Dashboard**. A later refresh error is shown as a retryable error toast over the dashboard (`AppErrorToastPresenter`), content stays. |

"Open positions" = securities whose net recorded quantity > 0 and whose ledger is valid. A user who sold everything gets the empty state but still has the `Registos` (Records) history button in the header.

**Empty state** (`PortfolioEmptyState.swift`), centred, max width 480:
1. Briefcase icon, accent colour, in a 72-pt accent-tinted (12 %) circle.
2. Title `Ainda não tens posições` (No positions yet).
3. Message `Regista as tuas compras para acompanhares o valor e o desempenho da carteira.` (Record your purchases to track portfolio value and performance.)
4. Prominent large button `Registar compra` (Record purchase), plus icon → opens the transaction editor in "new purchase" mode.
5. Feature row link `Simular investimento` (Simulate investment) / `Define um cenário e explora a evolução do teu investimento.` → Simulation (other part).
6. Caption with raised-hand icon: the manual-entry notice quoted above.

**Refresh triggers.** On tab appear and every foreground: market quotes (`refreshIfNeeded`) and ledger load in parallel. Missing price history for held securities is fetched per security. Pull-to-refresh on the dashboard forces quotes (without history) + ledger + insights.

#### 2.C1.2 Header bar (pinned top, all states)

Left: page heading = current selection title — `Carteira` (Portfolio) when the user has no named portfolios, `Todas as carteiras` (All portfolios), `Principal` (Main), or the named portfolio's name.

Right, in order (icon-only glass buttons):

| Button | Icon | Shown when | Action |
| --- | --- | --- | --- |
| `Carteiras` (Portfolios) | stacked rectangles | ledger loaded | Portfolio (book) menu — 2.C1.9 |
| Privacy toggle `Ocultar valores` / `Mostrar valores` (Hide/Show values) | eye / eye.slash | always | Toggles privacy mode — 2.C1.16 |
| `Exportar ou importar` (Export or import) | ellipsis | ledger loaded | Transfer menu — 2.C1.12/13 |
| `Registos` (Records) | clock with arrow | ledger loaded and ≥ 1 record in the selected portfolio | Pushes the full records list — 2.C1.5 |

#### 2.C1.3 Dashboard (`PortfolioDashboardView.swift`) — sections in display order

Vertical scroll, 20-pt horizontal padding, 32-pt section spacing, no scroll indicators, soft top edge effect, pull-to-refresh.

**(1) Summary** (`PortfolioSummarySection.swift`) — centred:
- Capsule badge `Registos manuais` (Manual records), accent text on soft-accent fill.
- Title, one of: `Valor da carteira` (Portfolio value) · `Valor parcial da carteira` (Partial portfolio value — some positions have no quote) · `Valor da carteira indisponível` (Portfolio value unavailable — no position has a quote).
- Big value: sum of priced positions, AOA, **2 decimals**, display-financial type, no change animation. Masked in privacy mode.
- Change line (icon ↗ / ↘ / –, semibold, monospaced digits, green/red/secondary): `+12 345 Kz (+1,23%)` = signed AOA with **0 decimals** + signed percentage with **2 decimals**. If the chart has < 2 points: `Histórico insuficiente` (Insufficient history). Masked in privacy mode.
  - **Rule:** this is `PortfolioPeriodChange` = last chart point − first chart point of the **selected range**, percentage relative to the first point (omitted when the first point is 0). It is a **balance movement that includes purchases and sales**, not an investment return (`Data/PortfolioPeriodChange.swift`).
- When no position has a quote: value shows `—` and caption `Ainda não há cotações atuais para os instrumentos registados.` (No current quotes are available for the recorded instruments yet.); the change line is hidden.
- When some positions lack a quote: warning label (exclamation-circle, warning colour) `1 instrumento sem cotação atual` / `%lld instrumentos sem cotação atual`.

**(2) Performance chart** (`PortfolioPerformanceSection.swift`):
- ≥ 2 points: shared line `PriceChart`, height 180, line colour = change colour, value label `Valor da carteira`, accessibility title `Evolução da carteira` (Portfolio performance). Line width depends on range (1S 2.5 · 1M 2.0 · 3M 1.5 · 6M 1.3 · 1A 1.0 · Tudo 0.6).
- < 2 points: elevated card with chart icon and `O gráfico aparece quando existirem cotações históricas suficientes.` (The chart appears when enough historical quotes are available.)
- Range picker: **`1S` · `1M` · `3M` · `6M` · `1A` · `Tudo`** (1W/1M/3M/6M/1Y/All). Default `1M`. No 1D range for the portfolio.
- Privacy mode: the chart is replaced by a **unitless trend** line (values normalised 0–1, Y axis hidden, date labels kept, height 220, VoiceOver `Evolução da carteira. Valores ocultos.`) (`PortfolioPrivateTrend.swift`).

**(3) Primary button** `Registar compra` (Record purchase), plus icon, full width.

**(4) Section tabs** (segmented): `Posições` (Positions) · `Distribuição` (Allocation) · `Resumo` (Summary). Default `Posições`.

**(5) Weekly reading slot** `Leitura da semana` (Weekly review): 0–2 fact tiles that depend on the selected tab — 2.C1.14.

**(6) Tab content:**

*Posições* (`PortfolioHoldingsSection.swift`, `PortfolioHoldingRow.swift`) — one row per open position, hairline dividers, min height 76:
- Left: instrument logo; symbol (section-title weight); name (caption, 1 line); quantity `120 ações` / `35,5 unidades` (0–4 decimals; masked in privacy mode).
- Right: current value in AOA, **0 decimals** — or `Cotação indisponível` (Quote unavailable) in tertiary colour; below it the return versus cost `+4,20%` (2 decimals, signed) with ↗/↘/– icon in green/red/secondary — or `—` with an exclamation icon in warning colour when there is no quote. Both masked in privacy mode.
- Sort: **current value descending**; in privacy mode **by instrument id** (so order does not leak size).
- Tap → position detail (hint `Abre os detalhes da posição`). If the instrument is no longer in the market catalogue the row reads `Instrumento indisponível` (Instrument unavailable) and still opens the position's records.

*Distribuição* (`PortfolioAllocationSection.swift`, `PortfolioAllocationRow.swift`):
- If any open position has no quote: text `Sem cotações suficientes para calcular a distribuição.` (Not enough quotes to calculate allocation.)
- Else header `Distribuição` and up to **5 rows + one `Outros` (Other) row** aggregating the rest (subtitle `1 instrumento` / `%lld instrumentos`). Row: symbol, name; right: weight `42,5%` (**1 decimal, unsigned**) and value (AOA, 0 decimals); accent progress bar 0–100. Sorted by weight descending. Entire block masked in privacy mode.

*Resumo*, in order:
1. Secondary button `Rendimentos` (Income), calendar icon → income calendar (2.C1.11).
2. Metrics grid 2×2 (`PortfolioMetricsSection.swift`): `Valor investido` (Invested amount; AOA 0 dec) · `Valor atual` / `Valor parcial` / `Valor indisponível` (Current / Partial / unavailable; `—` when no quotes) · `Ganho/perda não realizado` or `Ganho/perda parcial` (signed AOA 0 dec, coloured) · `Variação face ao custo` or `Variação parcial face ao custo` (signed %, 2 dec, coloured). All masked in privacy mode.
3. `Dinheiro` (Cash) — 2.C1.8.
4. `Comparar com` (Compare with) — 2.C1.10 benchmark.
5. `Resultados por ano` (Results by year) — only when some year has realised gain or income — 2.C1.10.
6. `Simular investimento` feature row → Simulation.

**(7) Footer notice** (any tab) when some but not all positions lack a quote, warning colour: `Valores parciais: a distribuição e o ganho/perda usam apenas instrumentos com cotação.` (Partial values: allocation and gain/loss use only instruments with quotes.) *Code note:* the allocation actually hides entirely when any quote is missing (`PortfolioCalculator.allocations` returns `[]`), so the "allocation uses only quoted instruments" half of this sentence is not what the code does.

#### 2.C1.4 Calculation rules (`Data/PortfolioCalculator.swift`)

| Quantity | Rule |
| --- | --- |
| Ledger order | By trade day, then creation time, then id. Date-only (noon Luanda); no intraday time. |
| Cost basis method | **Weighted average cost** per instrument (also stated in the PDF footer: `Custo médio ponderado`). Not FIFO. |
| Buy | cost = qty × price × scale + fees; quantity and invested amount increase. Scale = 0.01 for bonds, else 1. |
| Sell | must not exceed held quantity (else whole ledger invalid). Realised gain = (qty × price × scale − fees) − qty × average cost. Invested amount reduced by the sold cost; reset to 0 when quantity hits 0. |
| Income | One gross payment per record (quantity fixed at 1); `fees` field = **tax withheld**; net income = gross − tax. Never changes quantity. |
| Average purchase price | invested ÷ quantity ÷ scale (so bonds show % of nominal). Includes purchase fees. |
| Current value | qty × latest usable quote × scale. A quote is "usable" only if the security is listed, quote available, quality checks pass and, when the market is open, the quote is from today (`MarketSecurity.hasUsableQuote`). Otherwise the position is "without current quote". |
| Unrealised P/L | current value − invested amount (per position); portfolio total sums only priced positions. |
| Return vs cost | P/L ÷ invested × 100, computed over priced positions only. |
| Invested amount (summary) | sum over **all** open positions, priced or not. |
| Allocation | each priced position ÷ total; produced only when **every** open position is priced; sorted descending. |
| Historical series (chart) | For each day that appears in any held security's daily history (within the range, ≤ today): Σ over securities with open quantity on that day of qty × that day's close × scale. **No forward fill** — if any open position lacks a price for that exact day the day is dropped. After the first trade, a day with no open position yields 0. Requires a valid ledger, at least one buy, and clean histories (one point per day). |
| Period change | last − first point of that series (see Summary). |
| Results per year | Realised gains, net income and fees bucketed by the calendar year of each record; years newest first; includes closed positions. |
| Validity | All records need qty > 0, price > 0, fees ≥ 0, non-future date, unique ids; income needs qty = 1 and tax ≤ gross. An oversell makes the ledger invalid → positions, chart, results and insights are empty. A new/edited record is rejected client-side if it would make a currently valid portfolio invalid; each named portfolio balances on its own (`PortfolioStore.permitsMutation`). |
| Precision | Quantities/prices are stored as decimals (server `NUMERIC(24,8)`); dashboard maths uses doubles; insight maths uses checked decimals. |

#### 2.C1.5 Records list (`Registos`)

Pushed from the header history button. Plain list of all records of the selected portfolio, **newest first**. Row (`PortfolioPurchaseRow.swift`):
- Symbol (semibold); `Instrumento indisponível` caption if the instrument is unknown.
- Date `3 mar 2026` (day, abbreviated month, year) + trailing ellipsis menu `Opções` (Options): `Editar registo` (Edit record, pencil) · `Eliminar registo` (Delete record, trash, destructive).
- Detail line (masked in privacy mode): `Compra · 10 ações · 12 500,00 Kz · 150,00 Kz em custos` — kind (`Compra` Buy / `Venda` Sell) · quantity + unit (`ações`/`unidades`; bonds show nominal as AOA 0 dec) · unit price (AOA 2 dec; bonds as % 2 dec) · optional fees `%@ em custos` (%@ in fees). Income: `Rendimento · 1 234,00 Kz` (+ fees). (`Rendimento` is a raw literal with no catalogue entry found — EN translation `UNVERIFIED`.)
- Delete confirmation dialog: title `Eliminar este registo?` (Delete this record?), message `Este registo será eliminado se os restantes registos continuarem válidos. Isto não altera as transações na tua corretora.` (This record will be deleted if the remaining records stay valid. This does not change transactions at your broker.), buttons `Eliminar registo` / `Cancelar`.

#### 2.C1.6 Position detail (`PortfolioPositionDetailView.swift`, `PortfolioPositionContent.swift`)

Pushed from a holding row. Inline nav title = symbol (fallback `Posição` Position). **Tab bar hidden.** Toolbar: privacy toggle; `Registar` (Record) plus-menu with `Registar compra` · `Registar venda` (Record sale) · `Registar rendimento` (Record income).

Content in order:
1. Logo (52), symbol (screen-title), name.
2. Caption `Valor atual` (Current value) and the value (AOA, 2 dec, display type; masked) — or `Cotação indisponível` in warning colour.
3. Metrics grid (2 columns):
   - `Quantidade` (Quantity; 0–4 dec) — for bonds `Valor nominal` (Face value; AOA 0 dec) · `Preço médio de compra` (Average purchase price; AOA 2 dec, bonds % 2 dec)
   - `Preço atual` (Current price; **not masked** — public data; `—` if none) · `Valor investido` (AOA 0 dec)
   - `Ganho/perda` (Gain/loss; signed AOA 0 dec; `—` if no quote) · `Desempenho` (Performance; signed % 2 dec)
   - only when non-zero: `Ganho realizado` (Realized gain; signed AOA 0 dec, coloured) · `Rendimentos líquidos` (Net income; AOA 0 dec)
4. Section header `Registos` (Records) with action `Registar compra`; this position's records (same row as 2.C1.5, without the symbol line), dividers between.

States: ledger not loaded → section placeholder (loading or failed with retry); position closed but records exist → plain list of its records; nothing left → system empty view `Posição indisponível` (Position unavailable) / `Esta posição já não faz parte da carteira.` (This position is no longer in your portfolio.)

#### 2.C1.7 Transaction editor (sheet) (`PortfolioTransactionEditor.swift`, `PortfolioTransactionForm.swift`, `PortfolioInstrumentPicker.swift`)

Entry points (`PortfolioEditorRequest`): new purchase (dashboard/empty state — starts with the instrument picker), add purchase / sale / income for a known instrument (position detail), record income prefilled with amount and date (income calendar), edit an existing record (kind and instrument cannot be changed).

**Step A — instrument picker** (only for "new purchase"), title `Escolher instrumento` (Choose instrument):
- Pinned search field `Procurar instrumentos` (Search instruments) and, while not focused, tabs `Todos` (All) · `Ações` (Stocks) · `Fundos` (Funds) · `Obrigações` (Bonds).
- Count caption `%lld instrumentos`.
- Card rows: standard asset row (logo, symbol, name, price, change) + accent plus-circle. Eligible = visible listed instruments (delisted and matured bonds hidden) of a ledger-supported kind; sorted by symbol; search uses the global securities search (symbol / name / issuer).
- No results → system "no search results" view.

**Step B — form.** Titles: `Registar compra` · `Registar venda` · `Registar rendimento`; editing: `Editar compra` (Edit purchase) · `Editar venda` · `Editar rendimento`.

| Block | Buy | Sell | Income |
| --- | --- | --- | --- |
| Header | logo 48, symbol, name; `Alterar` (Change) button only in new-purchase flow | same (no Change) | same |
| Headline card (large input) | `Quantas unidades compraste?` (How many units did you buy?) — bonds: `Valor nominal comprado` (Nominal amount bought) with `Kz` suffix | `Quantas unidades vendeste?` — bonds: `Valor nominal vendido` | `Valor bruto recebido` (Gross amount received), amount field 44 pt + `Kz` |
| Field 1 | `Preço por unidade` (Unit price) `Kz` — bonds: `Preço face ao nominal` (Price as percent of par) `%` | same | — |
| Field 2 | `Comissões` (Fees) `Kz` | `Comissões` | `Imposto retido` (Tax withheld) `Kz` |
| Date | `Data da compra` (Purchase date) | `Data da venda` (Sale date) | `Data do pagamento` (Payment date) |
| Total line (shown when > 0, AOA 2 dec) | `Custo total` (Total cost) = qty × price (× 0.01 bonds) + fees | `Valor líquido da venda` (Net sale proceeds) = gross − fees | `Valor líquido recebido` (Net amount received) = gross − tax |
| Reference | `Última cotação` (Last quote) row when a usable quote exists | same | — |

- Defaults for a new record: quantity 1, price 0, fees 0, date today. Quantity input: pt-AO number, 0–8 decimals; number pad for equities, decimal pad otherwise. Amount fields use the Angolan amount field (live grouping, decimal comma, `Concluído` (Done) keyboard accessory).
- Date picker: date only, Luanda calendar, cannot select after today.
- Bottom pinned action (hidden while the keyboard is up; spinner while saving): `Guardar compra` (Save purchase) · `Guardar venda` · `Guardar rendimento`, checkmark icon.
- **Validation** (messages appear under the field after the first save attempt, red):
  - quantity ≤ 0 → `Introduz uma quantidade superior a zero.` (Enter a quantity greater than zero.)
  - equity with fractional quantity → `A quantidade deste instrumento deve ser um número inteiro.` (… must be a whole number.)
  - price ≤ 0 → `Introduz um preço por unidade superior a zero.`; income → `Introduz um valor superior a zero.`
  - overflow → `O custo excede o valor suportado. Verifica a quantidade e o preço.`
  - fees < 0 → `Introduz um valor igual ou superior a zero.`
  - income tax > gross → `O imposto retido não pode exceder o valor bruto.`
  - future date → `A data do registo não pode estar no futuro.`
- Save failure (including "this would oversell") → error toast title `Não foi possível guardar o registo` (Could not save the record), message = mapped error or `Verifica os dados e tenta novamente.` (Check the data and try again.)
- Unsaved changes: swipe-to-dismiss disabled; close button asks `Descartar alterações?` (Discard changes?) / `Os dados introduzidos ainda não foram guardados.` / `Descartar` (Discard) · `Continuar a editar` (Continue editing).
- Idempotent save: one id per editor instance; retrying never creates a duplicate.
- New records are written to the **selected** named portfolio; when "All portfolios" or "Main" is selected they go to the main portfolio.
- A successful *new* record counts as a "completed action" for the contextual App Store review prompt (`ReviewPromptCoordinator … .portfolioTransactionSaved`).

#### 2.C1.8 Cash (`PortfolioCashSection.swift`, `Data/PortfolioCash.swift`) — **Plus to add**

Section `Dinheiro` (Cash) in the Summary tab.
- No movements yet: secondary button `Registar dinheiro` (Record cash), plus icon. Free users → paywall with reason `Acompanhe depósitos, levantamentos e taxas com o Plus.` and the editor opens after a successful upgrade.
- With movements: header link `Movimentos` (Movements) and a card with a 2×2 grid (all masked in privacy mode):
  - `Saldo em dinheiro` (Cash balance) — warning colour if negative
  - `Depositado` (Deposited) = deposits − withdrawals
  - `Valor total` (Total value) = positions' market value + cash balance (`—` if no quotes)
  - `Resultado` (Net result) = total value − net deposited, signed, green/red (`—` if no quotes)
  - all AOA, 0 decimals.
- **Cash balance rule:** deposits − withdrawals − fees − Σ(buy cost incl. fees) + Σ(sale proceeds net of fees) + Σ(income net of tax). Scoped to the selected portfolio.
- Editor sheet (medium height), title `Registar dinheiro`: segmented kind `Depósito` (Deposit) · `Levantamento` (Withdrawal) · `Taxa` (Fee); amount `Montante` (Amount); date `Data` (≤ today); toolbar close + `Guardar` (Save; disabled until amount > 0). Idempotent id per sheet. Server `PLUS_REQUIRED` → sheet closes and paywall opens.
- Movements sheet `Movimentos`: newest first; row = kind, date `3 mar 2026`, signed amount (deposit +, withdrawal/fee −; masked); swipe `Apagar` (Delete); toolbar `+ Registar dinheiro`.

#### 2.C1.9 Multiple portfolios ("books") (`PortfolioBookMenu.swift`, `Data/PortfolioBooks.swift`) — **Plus to create**

- Concept: one implicit **main** portfolio (`Principal`, no record) plus user-named portfolios. Selection: `Todas as carteiras` (All portfolios — combined view), `Principal`, or a named one. When no named portfolio exists the selection is always combined and the title is just `Carteira`.
- Menu content: (if any named portfolio) a single-choice picker `Todas as carteiras` / `Principal` / names; `Nova carteira` (New portfolio, plus); (if any) `Gerir carteiras` (Manage portfolios, pencil); (when a single portfolio is selected) `Partilhar só de leitura` (Share read-only, link) — 2.C1.15.
- `Nova carteira` → alert with field `Nome` (Name), `Cancelar` / `Criar` (Create; disabled when blank). Free users → paywall reason `Carteiras separadas fazem parte do Plus.` Duplicate name → alert `Já tens uma carteira com esse nome` (You already have a portfolio with that name) / `Concluído`. After creation the new portfolio becomes selected.
- `Gerir carteiras` sheet: list of names; tap → rename alert `Mudar nome` (Rename) / `Nome` / `Cancelar` · `Guardar`; swipe `Apagar` → confirmation `Eliminar %@?` (Delete %@?) / `Os registos desta carteira também são eliminados.` (This portfolio's records are deleted too.) / `Eliminar carteira e registos` (Delete portfolio and records). Deleting also removes its records and cash movements; selection falls back to combined.
- Everything on the dashboard (positions, chart, cash, results, CSV export, records) follows the selection. **Insights, widgets and notifications always use the whole ledger** across all portfolios (`PortfolioStore.visibleTransactions` comment).
- Selection is remembered on the device; an unknown/deleted id falls back to combined.

#### 2.C1.10 Benchmark and yearly results

**Benchmark `Comparar com` (Compare with)** (`PortfolioBenchmarkSection.swift`, `Data/PortfolioBenchmark.swift`) — **Plus**
- Locked: secondary button `Comparar com inflação e taxas` (Compare with inflation and rates) → paywall reason `Comparar a carteira com inflação e taxas faz parte do Plus.`
- Unlocked: loads the latest value of each reference rate; segmented picker of those available, in this order: `Inflação` (Inflation, year-on-year) · `Taxa BNA` (BNA policy rate) · `LUIBOR` (overnight) · `BT 364 dias` (364-day T-bill). Default Inflation.
- Chart (height 160, hidden entirely in privacy mode): portfolio line (accent, solid) vs benchmark line (secondary, dashed 4/3, 1.5 pt); trailing Y axis with compact labels (`k`, `M`, `B`); X axis hidden.
- Legend (masked values): `Carteira` value · `{rate} · 12,50%` value · `Diferença` (Difference) signed, green when portfolio ≥ benchmark else red. AOA.
- Loading: spinner. Load failure: `Tentar novamente` (Try again). < 2 chart points: the "chart appears when…" caption.
- **Rule:** "what the same money would be worth at that rate": start from the first chart point's value on the selected range, compound continuously at `ln(1 + rate) / 365` per day, and replay cash flows after the first point (buys add their cost, sales and income remove their net amount), floored at 0. Constant rate = latest published value.

**`Resultados por ano` (Results by year)** (`PortfolioResultsSection.swift`)
- One card per year (newest first) that has realised gain or net income: year + `Relatório PDF` (PDF report, document icon); metrics `Ganho realizado` (signed AOA 0 dec, coloured) and `Rendimentos líquidos` (AOA 0 dec).
- `Relatório PDF` is **Plus** (free → paywall reason `O relatório anual em PDF faz parte do Plus.`). Plus users get the system share sheet with a generated file.

**Year report PDF** (`PortfolioYearReport.swift`): A4 portrait (595 × 842 pt), always white/black, file `invest-ao-relatorio-{year}.pdf`.
- Header: `invest.ao`; title `Ganhos e rendimentos {year}` (Gains and income); sub-line `{portfolio name} · Gerado a {long date}`.
- Table columns: `Instrumento` (symbol + name) · `Ganho realizado` (signed) · `Rendimentos líquidos` · `Imposto retido` (Tax withheld) · `Comissões` (Commissions = all fees − withheld tax). AOA, 2 decimals. One row per instrument with any non-zero figure that year; 22 rows per page; `Total` row on the last page.
- Footer: `Custo médio ponderado. Valores em AOA a partir dos registos da carteira.` (Weighted average cost. AOA amounts from the portfolio records.) and `page/pages`.

#### 2.C1.11 Income calendar (`IncomeCalendarView.swift`, `Data/IncomeCalendar.swift`, `IncomeReminderScheduler.swift`)

Pushed from Summary → `Rendimentos` (Income). Inset grouped list, large title, pull-to-refresh, spinner on first load, retryable error toast.

Sections in order:
1. **Totals & reminders (Plus).** Plus: `Próximos 12 meses` (Next 12 months) total, `Últimos 12 meses` (Last 12 months) total (AOA, masked in privacy mode), toggle `Lembrar no dia do pagamento` (Remind me on payment day). Free: a single row `Totais e lembretes` (Totals and reminders) with a bold `PLUS` tag → paywall reason `Totais e lembretes de rendimentos fazem parte do Plus.` The calendar itself is free.
2. `Próximos` (Upcoming) — events, or `Sem pagamentos anunciados` (No announced payments).
3. `Últimos 12 meses` (Last 12 months) — past events, newest first (hidden if none).

Row: logo 36 · symbol · `Dividendo|Cupão|Reembolso · 3 mar 2026` (Dividend / Coupon / Redemption) · amount (gross AOA, masked) · status: past + matching record → green check `Registado` (Recorded); past without record → text button `Registar` (Record) which opens the income editor prefilled with the amount and date; upcoming → nothing.

Event rules:
- **Dividends** — for held equities whose issuer has announced dividends with payment date in the last 365 days or later. Entitled quantity = shares held **before the ex-dividend date**; if no ex-date, shares held through the record date; if neither, shares held before the payment date. Amount = quantity × gross dividend per share. Skipped when entitlement is 0.
- **Bond redemption (`Reembolso`)** — maturity date is decoded from the BODIVA bond code (8 characters: 2 letters, day, month letter, 2-digit year, 1 char — `MarketDiscovery.swift:173`). If maturity ≥ today and nominal held > 0 → upcoming event for the nominal held.
- **Coupons** — only when the user has saved the bond's coupon terms on this device (annual coupon rate 0–<100 %, frequency 1/2/4 per year; entered on the bond's asset page, stored locally — `BondTermsStore`). Coupon dates are stepped back from maturity within [today − 365 d, today + 365 d]; amount = nominal held before the date × (rate ÷ frequency) ÷ 100.
- **Status** — payment before today: "recorded" if the ledger has any income record for that security within **±42 days** of the payment date, else "unrecorded". Otherwise upcoming.
- **Totals** — next 12 months = upcoming events within 365 days; last 12 months = all past events (recorded or not), gross.
- Events follow the selected portfolio.

Reminders (Plus, device-local): enabling asks for notification permission (alert + sound); if denied the toggle stays off. Schedules a local notification at **09:00 Luanda on the payment day** for up to **24** upcoming events, rebuilt on every calendar load. Title `Dividendo de %@ hoje` (%@ dividend today) / `Cupão de %@ hoje` / `Reembolso de %@ hoje`; body = the amount. Nothing is sent to a server. *Privacy note:* this local reminder body carries an amount, unlike server pushes which are always generic.

#### 2.C1.12 CSV export / import (`PortfolioTransferViews.swift`, `Data/PortfolioCSV.swift`) — free

Header ellipsis menu: `Exportar CSV` (Export CSV; only when there are records) · `Importar CSV` (Import CSV) · `Ler extrato` (Read statement — 2.C1.13).

**Export.** System share sheet, file `invest-ao-carteira.csv`, preview title `Carteira (CSV)`. Format: semicolon-separated, CRLF line ends, decimal **comma**, fields quoted only when needed, oldest record first, selected portfolio only.

| Column | Content |
| --- | --- |
| `data` | `yyyy-MM-dd` |
| `simbolo` | instrument symbol |
| `instrumento` | instrument name |
| `tipo` | `compra` / `venda` / `rendimento` |
| `quantidade` | quantity (nominal for bonds; `1` for income) |
| `preco` | unit price (% of nominal for bonds; gross amount for income) |
| `custos` | fees (tax withheld for income) |
| `valor_liquido` | net cash effect in AOA |
| `moeda` | currency code (default `AOA`) |

**Import.** File picker (CSV, TSV or plain text). File must be ≤ **2 MB**, UTF-8 or Latin-1; otherwise toast `Não foi possível ler o ficheiro` (Couldn't read the file) / `Escolhe um ficheiro CSV com até 2 MB.` Tolerances: delimiter auto-detected from the header (`;`, tab or `,`); BOM stripped; headers matched case/diacritic-insensitively with aliases —

| Field | Accepted header names (normalised) | Required |
| --- | --- | --- |
| date | data, date, tradedate, datadaoperacao, datadeoperacao | yes |
| symbol | simbolo, symbol, ticker, codigo, code | yes |
| type | tipo, type, operacao, side | yes |
| price | preco, price, precounitario, unitprice, cotacao, valor, amount | yes |
| quantity | quantidade, quantity, qty, valornominal, nominal | no (default 1) |
| fees | custos, comissoes, fees, comissoesimpostos, imposto, impostoretido, tax | no (default 0) |

- Type values: buy = compra/buy/c/b/purchase; sell = venda/sell/v/s/sale; income = rendimento/dividendo/dividend/cupao/coupon/juro/juros/interest/income.
- Dates: `yyyy-mm-dd` or `dd-mm-yyyy` with `-`, `/` or `.`.
- Numbers: decimal comma or point, thousands separators and spaces tolerated, trailing `kz` / `aoa` / `%` stripped.
- Income rows: quantity × price is multiplied out into one gross payment.
- Instrument must exist (by symbol), be ledger-supported and AOA. Equities need whole quantities. A row equal to an existing record or an earlier row (same instrument, type, date, quantity, price) is a duplicate.

**Review sheet** `Importar registos` (Import records): one row per line with a green check or warning icon, `{SYMBOL} · linha N` (or `Linha N` when the symbol is missing) and a detail — success: `Compra · 10 × 12 500,00 · 3 mar 2026` / `Rendimento · 1 234 Kz · …` (masked in privacy mode); failure reason:

| Reason | Copy |
| --- | --- |
| missing columns | `Faltam colunas: data, símbolo, tipo e preço.` (Missing columns: date, symbol, type and price.) |
| unknown symbol | `Instrumento não encontrado.` (Instrument not found.) |
| unsupported | `Instrumento não suportado na carteira.` |
| bad date | `Data inválida.` |
| bad type | `Tipo inválido. Usa compra, venda ou rendimento.` |
| bad number | `Número inválido.` |
| invalid record | `Valores inválidos para este instrumento.` |
| duplicate | `Já registado.` (Already recorded.) |

Empty file → `Ficheiro vazio`. Bottom action `Importar %lld registos` (Import N records) for the valid rows. Saving writes oldest first into the selected portfolio and **stops at the first rejected write**; partial result → toast `Importação incompleta` + `Foram importados %lld de %lld registos.`; nothing saved → mapped error or `Os registos deixariam a carteira inválida. Verifica as vendas.` (These records would leave the portfolio invalid. Check the sales.) A retried import skips rows already saved.

#### 2.C1.13 Statement reader (`StatementReader.swift`, `Data/StatementTextParser.swift`) — **Plus**

`Ler extrato` (Read statement) → (free: paywall reason `Ler extratos em fotografia ou PDF faz parte do Plus.`) → dialog with sources `Fotografia` (Photo — photo library picker) and `Ficheiro PDF ou imagem` (PDF or image file — file picker). Recognition is **on device** (text recognition, Portuguese + English, accurate mode; PDFs: first **12 pages**, each rendered to ~2000 px); nothing is uploaded. A large spinner overlays while reading.

Parsing: text fragments on the same baseline are joined into rows. A row is used only if it contains a known instrument symbol and a date is known (in the row or carried from the previous dated row; `yyyy-mm-dd` or `d/m/yyyy`). Type from keywords (sell: venda/sell/sale; buy: compra/buy/purchase/subscricao; income: dividendo/dividend/cupao/coupon/juro/interest/rendimento). First number = quantity, second = price (income: first number = gross). Fees are set to 0. The result is converted to the app's CSV and shown in the **same import review sheet**, so every row is validated and nothing is saved without confirmation; rows with no recognised type appear as `Tipo inválido…`.

Nothing usable → toast `Nenhum movimento encontrado` (No transactions found) / `Usa um extrato com data, código BODIVA, quantidade e preço em cada linha.` (Use a statement with a date, BODIVA code, quantity and price on each line.)

#### 2.C1.14 Portfolio insights — "Leitura da semana" (Weekly review)

Files: `PortfolioInsightSection.swift`, `Data/PortfolioInsightPresentation.swift`, `PortfolioInsightDetails.swift`, `Data/PortfolioInsightCoordinator.swift`, `Core/Intelligence/Portfolio*.swift`.

**What it is.** Two verified facts about the **latest completed trading week** (Mon–Fri, Luanda), computed from the whole ledger and verified BODIVA closing prices: a fixed-quantity weekly price performance and an allocation snapshot at the week's last close. No scores, risk labels or recommendations. There is no standalone insights screen: at most **two tiles** appear between the section tabs and the tab content.

**Eligibility (fail-closed).**
- Only **equities and funds in AOA** count. Any open bond (or other unsupported/non-AOA holding) suppresses the whole fact — it is never dropped from the denominator.
- Every expected trading session of the week, plus the last session before Monday (baseline), must have a final verified close for every held instrument; no forward fill. Holidays use the verified calendar.
- **Performance** additionally requires no trade dated inside the week, nor between the baseline day and Monday. A purchase is never counted as a gain. **Allocation** tolerates trades inside the week (uses quantities through Friday).
- Ledger valid (no oversell, unique ids, whole-share equities), inputs fetched < **15 minutes** ago.
- Facts expire 15 minutes after fetch (and at most 7 days after the week) and vanish from screen at that moment (the section re-evaluates every 60 s).

**Tiles per tab** (title caption + info-circle, big value, context caption; tap opens the detail sheet; max 2):

| Selected tab | Tile | Title | Value | Context |
| --- | --- | --- | --- | --- |
| Distribuição | largest position | `Maior posição · {SYM}` (Largest position) | weight `%`, unsigned, 1 dec | `Do valor registado ao fecho de {date}.` (Of the recorded value at the close on …) |
| Distribuição | sector (if > 1 sector identified) | `Setor do emitente · {sector}` (Issuer sector) | weight % | `Todas as posições têm setor identificado no catálogo atual.` |
| Distribuição | else issuer (if > 1 issuer) | `Maior peso por emitente · {issuer}` (Largest issuer weight) | weight % | `Distribuição pelas posições registadas ao fecho.` |
| Resumo (≥ 2 positions) | strongest contributor (if ≠ 0) | `Maior contributo · {SYM}` (Largest contribution) | `+0,42 p.p.` (2 dec, signed) | `Contributo para a variação por cotação, {d MMM – d MMM}.` |
| Resumo (≥ 2 positions) | weakest contributor (if ≠ 0) | `Menor contributo · {SYM}` (Lowest contribution) | p.p. | `Entre todas as posições verificadas no mesmo período.` |
| Posições (and Resumo with 1 position, and Distribuição when no allocation fact) | weekly price change | `Variação semanal por cotação` (Weekly price change) | `+1,2%` (1 dec, signed) | `{period}. Quantidades constantes; exclui rendimentos e custos.` (Constant quantities; excludes income and costs.) |
| same, if ≥ 2 positions | breadth | `Movimento das posições` (Position movements) | `%lld subiram · %lld desceram` (N rose · M fell) | `%lld sem variação, entre %lld posições verificadas.` |

Formatting guards: a non-zero value smaller than the display unit is written as a range — `Entre 0% e +0,1%` / `Entre −0,1% e 0%`, `<0,1%`, `>99,9%`, `Entre 0 e +0,01 p.p.` — never a rounded 0 or 100 (`Core/Formatting/FinancialPresentationFormat.swift`).

**Formulas.** V₀ = Σ qᵢ·Pᵢ,baseline; V₁ = Σ qᵢ·Pᵢ,final; weekly price change = 100·(V₁−V₀)/V₀; contribution cᵢ = 100·qᵢ·(Pᵢ,₁−Pᵢ,₀)/V₀ in percentage points (ranked by monetary contribution, ties by id); allocation wᵢ = 100·Qᵢ·Pᵢ,final / Σ; issuer/sector groups only when **every** position has that metadata (never an "unknown" slice).

**Other states of the slot.**
- Generating: small progress row `A verificar a semana` (Checking the week).
- Unavailable (backend failure, or ready but nothing visible): small secondary button `Atualizar leitura da semana` (Refresh weekly review), refresh-arrow icon.
- Insufficient data (empty ledger, missing closes, bonds held, trades during the week…): **nothing is shown** — the slot stays empty.
- Saved reading (market closed/post-close/weekend/holiday only, and ledger + quote fingerprints unchanged): the tiles are replayed from the device cache with the caption `Leitura guardada · dados de {EEE, d MMM 'às' HH:mm} · não atualizados em tempo real.` (Saved insight · data from … · not updated live.) Saved readings live ≤ 7 days and are withdrawn while a record is being saved, when the ledger changes, when quotes change, on sign-out.
- Privacy mode: the tiles disappear entirely (the facts are classified private-financial).
- Opening a tile marks the matching Activity Center item as read and records an "opened" personalisation signal.

**Detail sheet** `Detalhe da carteira` (Portfolio details) — toolbar: close, privacy toggle.

*Performance fact:*
1. Period capsule `{d MMM yyyy – d MMM yyyy}`; header `Variação por cotação` (Price-based change); big percentage (coloured); line with ↗/↘/– and the signed AOA change (2 dec); caption `Dados observados em {timestamp}.` + `Esta leitura não é uma atualização em tempo real.`
2. Notice `Valores aproximados` (Approximate values): `Baseiam-se nos seus registos manuais e nos preços de fecho. Não temos acesso às suas posições reais na corretora, pelo que os valores podem não corresponder à sua carteira real.`
3. `Primeiro fecho` (First close) value · `Último fecho` (Last close) value (AOA, 2 dec).
4. `Posições incluídas` (Included positions) card — per position: symbol + `Na variação total` (Of total change) in p.p.; `Quantidade constante` (Constant quantity); `Valor inicial` / `Valor final`; `Contributo monetário` (Monetary contribution, signed, coloured).

*Allocation fact:*
1. Capsule `Fecho de {date}` (Close on …); header `Distribuição ao fecho` (Allocation at close); big total value; caption `Valor total incluído · quantidades dos registos até ao fim dessa semana.`; same observation caption.
2. Same approximate-values notice.
3. `Posições incluídas` — per position: symbol + `Do valor total` (Of total value) %; `Quantidade registada` (Recorded quantity); `Preço de fecho` (Closing price) · `Valor incluído` (Included value).
4. If available: `Por emitente` (By issuer) and `Por setor do emitente` (By issuer sector) groups — name, % of total, member symbols.

*Both:* collapsible `Fontes e limites` (Sources and limits) with three paragraphs (records + verified BODIVA closes, a missing quote prevents the calculation; excludes cash, dividends, coupons, fees, taxes, unrecorded corporate actions; issuer/sector catalogue date) and the footer `Verificado em {timestamp · Luanda}.` In privacy mode the body is replaced by `Valores ocultos` / `Posições e cálculos ocultos no Modo de privacidade.` and every metric reads `Valores ocultos`.

#### 2.C1.15 Read-only share links (`PortfolioShareSheet.swift`, `Data/PortfolioShares.swift`) — **Pro**

Books menu → `Partilhar só de leitura` (Share read-only). Offered only for a single portfolio (main or a named one; not for the combined view when named portfolios exist). Free/Plus → paywall for the **Pro** tier.

Sheet title `Partilhar {portfolio}`:
- Empty: `Sem links` (No links) with secondary button `Novo link` (New link).
- Toolbar `+ Novo link` → alert with field `Para quem?` (Who is it for?) and `Cancelar` / `Criar`. Label trimmed, max **40 characters**.
- After creation a row `Enviar link` (Send link) opens the share sheet with the URL **`https://invest.ao/partilha/{token}`**. The token is only known at creation time; it cannot be re-read later.
- Existing links: label + creation date; swipe `Revogar` (Revoke).
- Messages: `Chegaste ao limite de 20 links.` (limit **20**, server-enforced) · `Não foi possível atualizar os links.`
- What the recipient sees is a **web page outside this repo** — `UNVERIFIED` here; the website plan must provide `/partilha/{token}`.

#### 2.C1.16 Privacy mode inside Portfolio

Toggle in the header, position detail and insight sheet (eye / eye-slash, selection haptic, symbol-replace transition). First activation shows a one-time alert `Valores ocultos` (Hidden values): `Oculta valores da carteira e dos alertas nesta aplicação. Os instrumentos, a tendência do gráfico, as cotações públicas e os campos de edição continuam visíveis. Não altera as notificações do sistema.` / `Entendido` (Got it).

Behaviour (`Core/Components/SensitiveValue.swift`): masked values keep their layout slot and show `••••••` in secondary colour; hiding is instant, revealing fades (0.15 s); masked content is not selectable and VoiceOver reads `Valor oculto` (Hidden value). Masked: portfolio value and change, holding quantity/value/return, all metric tiles except *current price*, allocation block, cash figures, benchmark legend (chart removed), income amounts and totals, record detail lines, import review details, cash movement amounts. Not masked: instrument symbols/names, public prices, form inputs. Holdings re-sort by id; the chart becomes a unitless trend; insight tiles and insight details are hidden.

#### 2.C1.17 Tier gating summary (Portfolio)

| Capability | Free | Plus | Pro | Lock presentation |
| --- | --- | --- | --- | --- |
| Ledger: buy / sell / income records, positions, chart, allocation, metrics | ✓ | ✓ | ✓ | — |
| Records history, position detail | ✓ | ✓ | ✓ | — |
| CSV export and import | ✓ | ✓ | ✓ | — |
| Weekly reading insights | ✓ | ✓ | ✓ | — |
| Income calendar list + "Registar" shortcut | ✓ | ✓ | ✓ | — |
| Income totals + payment-day reminders | — | ✓ | ✓ | Row `Totais e lembretes` with `PLUS` tag → paywall |
| Named portfolios (create) | — | ✓ | ✓ | Tapping `Nova carteira` opens paywall; action resumes after upgrade |
| Cash movements (add) | — | ✓ | ✓ | Tapping `Registar dinheiro` opens paywall |
| Benchmark vs inflation/rates | — | ✓ | ✓ | Section shows only the unlock button |
| Yearly PDF report | — | ✓ | ✓ | `Relatório PDF` button opens paywall |
| Statement photo/PDF reader | — | ✓ | ✓ | Menu item opens paywall |
| Read-only share links | — | — | ✓ | Menu item opens **Pro** paywall |

Paywall presentation: full-screen cover with the subscription screen and a `Continuar no gratuito` (Continue with Free) dismiss; the interrupted action resumes once after the server confirms the tier (`SubscriptionGatePresenter`, `SubscriptionStore.requestUpgrade/resumeAfterUpgrade`). Existing data created while entitled stays visible (cash metrics, portfolios) — only creation is gated client-side.

#### 2.C1.18 Doc vs code (Portfolio)

- `docs/portfolio-insight-catalog.md` describes the ledger as buys/sells only and says "no share/export path is added"; the code has an income kind with fees/withheld tax, CSV export, PDF report and Pro share links.
- The same doc says bonds are excluded: true for **insights**, but the ledger and dashboard do accept bonds (nominal × % pricing).
- `docs/subscription-foundation.md` lists only Plus; the code has a Pro tier (`ao.invest.pro.monthly/annual`) gating share links (and order-book depth, other part).

---

### 2.C2 Watchlist (`Lista` tab · screen title `A tua lista`)

**Purpose.** A personal, ordered list of instruments to follow: live quote rows, quick access to alerts, optional groups, and up to two "weekly reading" observations about the followed instruments.

**Where it lives.** Fourth tab, label `Lista` (Watchlist) (`ApplicationShell.swift:104-107`); also pushed from Home with a back button (`WatchlistView(showsBackButton: true)`), in which case the tab bar is hidden and a compact header is used. Files: `Invest.AO/Features/Watchlist/**`.

**Auth.** Signed-in only (tab shows the authentication screen otherwise). Membership, order and groups are stored on the server per account; changes are optimistic with rollback on failure.

#### 2.C2.1 Screen states (`WatchlistView.swift`)

| # | Condition | UI |
| --- | --- | --- |
| 1 | No live market snapshot yet but a saved weekly reading exists | Saved-reading caption + the insight card only (no quote rows). |
| 2 | Watchlist idle/loading | Skeleton: 6 instrument-row skeletons (78 pt) with dividers; VoiceOver `A carregar títulos acompanhados` (Loading watched securities). |
| 3 | Watchlist load failed | Section placeholder titled `Lista de acompanhamento` (Watchlist) with retry. |
| 4 | Market snapshot loading / failed | Skeleton / shared loadable error with retry. |
| 5 | Loaded, nothing followed | **Empty state**. |
| 6 | Loaded | **List**. |

Market refresh errors while content is on screen surface through the shared refresh-error modifier (toast). State changes cross-fade (0.24 s, off with Reduce Motion).

**Empty state** (`WatchlistEmptyState`): 112-pt soft-accent circle with a rising-chart icon and a small star badge (warning colour); title `O teu radar ainda está vazio.` (Your radar is still empty.); message `Adiciona os instrumentos que queres acompanhar para veres as suas cotações num só lugar.` (Add the instruments you want to follow to see their quotes in one place.); prominent large button `Adicionar instrumentos` (Add instruments), plus icon.

#### 2.C2.2 Header (pinned)

- Root tab: page heading `A tua lista` (Your watchlist) with subtitle `%lld instrumentos a acompanhar` (N watched instruments) once loaded. Pushed variant: only the count line (nav bar shows the title).
- Buttons (right): `Grupos` (Groups, folder icon — only when the list is non-empty) and `Adicionar instrumentos` (plus; disabled until the market snapshot is loaded).
- Group tabs (only when ≥ 1 group and the list is non-empty): `Todos` (All) + group names. Selection remembered on device.
- Free-plan line (only when enforcement is on and the user is not Plus): link `Gratuito · %lld/3 ativos · %lld pausados. Escolher` (Free · X/3 assets · Y paused. Choose), sliders icon → Free-plan selection (2.C2.7).
- Alerts line (when any followed instrument has active alerts): bell + `%lld alertas ativos` (N active alerts).

#### 2.C2.3 List row (`WatchlistListItem`, shared `InvestAssetRow`)

- Left: logo 48, symbol (semibold), display name (1 line).
- Right: price — equities/funds as AOA with 2 decimals, bonds as % of nominal with 2 decimals — animated numeric transition (0.25 s); below it the percentage-change badge. If no confirmed price: `Preço por confirmar` (Price unconfirmed).
- Trailing 44-pt **bell button**: outline/secondary when no alerts; filled/accent with a small count badge when the instrument has active alert rules. VoiceOver: `Criar alerta para %@` (Create alert for %@) / `Gerir %lld alertas para %@` (Manage N alerts for %@).
- Min height 80; row tap → Asset details.
- Accessibility text sizes: content stacks vertically and the bell becomes a labelled text button `Criar alerta` / `Gerir alertas` (min 44 pt).

#### 2.C2.4 Row actions

| Gesture | Action |
| --- | --- |
| Tap row | Open asset details |
| Tap bell | Open the alert sheet for that instrument (`MarketAlertSheet` — Alerts part) |
| Swipe from leading edge (no full swipe) | `Alerta` (Alert), bell, accent tint → same alert sheet |
| Swipe from trailing edge (full swipe allowed) | `Remover` (Remove), trash, destructive → removes immediately with undo bar; selection haptic |
| Long-press (context menu) | `Grupos` submenu: a toggle per group + `Novo grupo` (New group — creates it and adds this instrument) |
| Drag to reorder | Only on `Todos` (order is shared across groups). No Edit button is shown; uses the list's built-in drag (exact gesture `UNVERIFIED`). |
| Pull to refresh | Forces market + weekly-reading refresh |

**Ordering.** Manual only — there are no sort options. New items are appended at the end. The order is persisted per account; items the saved order does not mention follow in catalogue order (`WatchlistOrdering.swift`, `MarketSnapshot.watchedSecurities(orderedBy:)`). Delisted instruments and matured bonds are hidden from the list.

**Remove + undo.** Removal is optimistic and also clears that instrument's alert configuration and group memberships. A bar pinned under the header shows `{SYMBOL} removido.` (%@ removed.) with `Desfazer` (Undo) and a close (✕) button. **There is no timer**: the bar stays until the user taps Undo or ✕, performs another watchlist change (add/remove/reorder), or the account changes. Undo re-inserts the item next to its previous neighbours and restores its original membership timestamp, automatic-alerts flag and alert configuration (server returns a receipt of the deleted row; undo is only offered while that receipt is valid) (`MarketStore.removeWatchlistForUndo/undoWatchlistRemoval`, `WatchlistRemovalReceipt`).

#### 2.C2.5 Add flow (`WatchlistAddView.swift`)

Full-height sheet with drag indicator, title `Adicionar instrumentos`, always-visible search field `Símbolo, nome ou emitente` (Symbol, name or issuer), close button.
- Lists every instrument **not yet followed**, sorted by name ascending, filtered by the query (shared market discovery search).
- Row: logo 40, symbol, name, accent plus-circle; tap adds instantly (row disappears, selection haptic) and **triggers the push-notification permission request / registration**. The sheet stays open for multiple adds.
- Empty: with no query → `Todos adicionados` (All added) / `Todos os títulos disponíveis já estão a ser acompanhados.`; with a query → `Sem resultados` (No results) / `Procura por símbolo, nome ou emitente.`
- Free-plan limit: adding beyond 3 is rejected by the server (`FREE_WATCHLIST_LIMIT`); the optimistic add is rolled back, the paywall opens with reason `O plano gratuito inclui 3 instrumentos guardados.`, and the add is retried automatically after a successful upgrade. Inline message string: `O plano gratuito permite guardar 3 instrumentos. Remove um instrumento ou utiliza o Plus.`

Instruments can also be followed/unfollowed from asset details and other surfaces (`toggleWatchlist`) — same rules.

#### 2.C2.6 Groups (`Data/WatchlistGroups.swift`) — **Plus to create / add members**

- Header `Grupos` menu: `Novo grupo` (New group, folder-plus) and, per existing group, a submenu `Mudar nome` (Rename, pencil) · `Apagar` (Delete, trash, destructive — no confirmation).
- Name prompt alert: title `Novo grupo` or `Mudar nome`, field `Nome`, `Cancelar` / `Guardar`. Name is trimmed, must be non-empty, truncated to **40 characters**.
- Creating from the header selects the new group; creating from a row's context menu adds that instrument to it.
- An instrument can belong to several groups. Selecting a group filters the list; an empty group shows a placeholder with the group name and a folder icon. Reordering is disabled inside a group.
- Removing an instrument from the watchlist removes it from all groups; deleting a group does not unfollow its instruments.
- Free users: `Novo grupo` (and adding a member, if the server refuses) opens the paywall with reason `Organize a sua lista em grupos com o Plus.`; the action resumes after upgrade. Renaming/deleting existing groups is not gated client-side.
- No client-side cap on the number of groups (`UNVERIFIED` server-side).

#### 2.C2.7 Free-plan selection (`FreePlanSelectionView`, in `Features/Subscriptions/SubscriptionManagementView.swift:492`)

Reached from the watchlist header line (and from the subscription screen). Title `Plano gratuito` (Free plan).
- Intro: `Escolhe até 3 instrumentos ativos e 1 para movimentos automáticos. Os restantes ficam guardados e pausados; não são eliminados.` Plus users also see `Tens Plus: todos os instrumentos continuam ativos. Esta escolha define as tuas preferências para o plano gratuito.`
- Section `Instrumentos ativos · %lld/3`: every followed instrument with `Ativo` (Active) / `Pausado` (Paused) and a check circle; tap toggles (max 3).
- Section `Movimentos automáticos` (Automatic movements): picker `Instrumento` with `Nenhum` (None) + the active instruments (free plan monitors automatic movement alerts for **1** instrument).
- `Guardar escolha` (Save selection) — enabled only when exactly min(3, followed count) are selected; result `Escolha guardada.` / `Não foi possível guardar. Atualiza a lista e tenta novamente.`; load failure `Não foi possível carregar o plano. Volta a abrir esta página para tentar novamente.`
- Rule: a free account that follows more than 3 (e.g. after a downgrade) keeps them all in the list; the extra ones are **paused, never deleted**.

Limits (`Core/Subscriptions/SubscriptionAccess.swift`): free watchlist **3**, free automatic-movement instruments **1**. Plus: copy says `Até 500` (Up to 500) — enforced server-side, not in the client (`UNVERIFIED`).

#### 2.C2.8 Alerts from the watchlist

The bell and the leading swipe open the shared **`MarketAlertSheet`** (documented in the Alerts part). `Features/Watchlist/WatchlistAlertView.swift` (a simpler form with above/below target, % movement, market-information toggles) exists but is **not referenced anywhere** in the app — treat it as dead code, do not port.

#### 2.C2.9 Watchlist insights — "Leitura da semana"

Files: `WatchlistInsightSection.swift`, `WatchlistInsightDetails.swift`, `WatchlistObservationSources.swift`, `Data/WatchlistInsightPresentation.swift`, `Data/WatchlistInsightCoordinator.swift`, `Core/Intelligence/Watchlist*.swift`, `InsightEngine.swift`.

**Placement.** A card at the **bottom of the list** (after the rows), header `Leitura da semana` (Weekly review), at most **2** observations. One evaluation per account is shared by Watchlist and Home.

**Card row.** 40-pt soft-accent rounded icon (chart-line; list for breadth; newspaper for publications) · caption title · semibold headline · caption context · trailing ellipsis menu with `Ver fontes` (View sources) and `Dispensar observação` (Dismiss observation). Tap opens the detail sheet. Footer when one of the two sources failed: `Algumas fontes estão temporariamente indisponíveis.` (Some sources are temporarily unavailable.) Saved-reading caption as in 2.C1.14 when replayed from cache.

**Insight types** (salience floor everywhere: **|change| ≥ 1 %**, exact boundary qualifies — `WatchlistSignificance`):

| Type | Trigger | Card title | Headline | Context |
| --- | --- | --- | --- | --- |
| Strongest weekly movement (`watchlistMovement`) | Every followed instrument has complete verified closes for the last completed week (baseline = last session before Monday); the largest absolute change is ≥ 1 %. One instrument is enough. Ties → id. | `Maior movimento` (Largest movement) | `{SYM} · +2,3%` (1 dec, signed) | `Cotação · {d MMM yyyy – d MMM yyyy}` (Quote · period) |
| Breadth (`watchlistBreadth`) | Complete data for the **whole** list, ≥ 2 instruments, at least one with ≥ 1 % | `Títulos acompanhados` (Watched securities) | `%lld em subida · %lld em descida` (N rising · M falling) | `%lld sem variação · %lld títulos atuais` + period on a second line |
| Session run (`watchlistSessionRun`) | An instrument's closes moved strictly in the same direction for **≥ 3 consecutive sessions** ending at the last close (needs 4 closes), cumulative ≥ 1 %. An unchanged session breaks the run. | `Sessões consecutivas` (Consecutive sessions) | `{SYM} · 3 sessões de subida|descida` | `+2,1% na sequência · {period}` |
| Closing extreme (`watchlistClosingExtreme`) | ≥ **5** verified closes in the window and the last close is strictly above every earlier close (or below), by ≥ 1 % | `Fecho em destaque` (Featured close) | `{SYM} · máximo|mínimo de fecho do período` | period |
| Linked publication (`watchlistInformation`) | A news article published in the last **7 days**, among the **20** most recent, explicitly linked (editorially) to a followed instrument, with exactly one valid HTTPS primary source | `Informação publicada` (Published information) | article title | `{source} · {date}` |

(A generic per-instrument `Movimento entre fechos` (Movement between closes) presentation exists for `assetPriceChange` facts; those are market-category facts and are not shown in the watchlist card.)

**Selection and novelty.** Ranking goes through the shared personalisation engine with surface minimum significance "noteworthy"; ties prefer publication → movement → run → extreme → breadth (`PersonalizationConfiguration.familyTiePriority`); max 2. Movement/run/extreme about the same instrument and same final close share one receipt, so only one of the family appears and **opening or dismissing one suppresses the others**. Opening the detail or choosing "Dismiss" consumes the observation (it leaves the card, is marked read in the Activity Center). Receipts are kept **on the device** per account for 56 days (not synced across devices). Merely seeing the card does not consume it. Finishing the current Weekly Wrap consumes the watchlist highlights it showed.

**Freshness.** Evidence fetched < 15 min ago; facts expire 15 min after fetch (the list re-evaluates exactly at each expiry); weekly facts never outlive 7 days after the week; the publication fact expires at min(fetch + 15 min, published + 7 days). Refreshed on tab appear/foreground, on pull-to-refresh, and skipped if nothing changed in the last 15 min.

**States.** Nothing to say → the card is simply absent (no empty state). Both sources failed → card absent (saved reading used if the market is closed). Privacy mode → card hidden (`personalContext` is suppressed in privacy mode); the quote rows remain.

**Detail sheet** `Observação` (Observation), in order:
1. (after feedback) a confirmation caption.
2. Accent caption title (long form: `Maior movimento da última semana concluída`, `A sua lista na última semana concluída`, `Sessões consecutivas`, `Fecho em destaque`, `Informação publicada`), large headline, context. In this sheet the headline/context may be replaced by the app's product-voice phrasing when a non-fallback composition exists (`InsightVoiceAdapter`).
3. Explanation paragraph, e.g. movement: `Maior variação percentual absoluta entre os %lld títulos que acompanha atualmente, todos com fechos verificados. Não representa rendimento, juros ou dividendos.`; breadth: `Cada título conta uma vez, sem ponderação por valor ou volume. Todos têm dados completos.`; run: `A sequência termina no último fecho verificado e inclui apenas sessões de mercado abertas. Uma sessão sem variação interrompe a sequência. Não prevê a próxima sessão.`; extreme: `O último fecho ultrapassou estritamente todos os fechos anteriores deste período. Não é um máximo ou mínimo intradiário, anual ou histórico.`; publication: `Publicação com fonte primária identificada. … Não implica impacto no preço.`
4. Clock line `Dados de {EEE, d MMM às HH:mm}. Não é uma atualização em tempo real.` (Data from … Not a live update.)
5. Sources — publication: link `Ler publicação` (Read publication → in-app article) and external link `Fonte: {name}`; price facts: disclosure `Fechos verificados (%lld)` (Verified closes) with the note `Preços de fecho BODIVA. Não inclui rendimentos, ajustes de operações societárias, compras ou vendas. Um fecho em falta impede a comparação desse título.`, one row per close (symbol, date, price + currency) and a nested disclosure `Detalhes dos registos` (Record details: `Registo: {id}`, `Recolhido em {timestamp}`; selectable text).
6. `Verificado em {timestamp · Luanda}.`
- Toolbar: close; menu `Preferências desta observação` (Preferences for this observation — hidden in privacy mode): `Não foi útil` (Not useful) · `Mostrar menos deste tipo na lista` (Show fewer of this type on the watchlist) · `Repor preferência` (Reset preference, only if one exists). Confirmations: `Preferência aplicada neste dispositivo. Eventos relevantes continuam elegíveis.` / `Preferência reposta.` / `Não foi possível aplicar a preferência. Tenta novamente.` / stale: `Esta observação já não está atualizada.`
- Privacy mode body: `Observação pessoal oculta no Modo de privacidade.`
- The per-type formula strings defined in the presentation (e.g. `100 × (fecho final − fecho de referência) ÷ fecho de referência.`) are **not rendered in this sheet** in 1.1.5 (used by other surfaces — `UNVERIFIED` where).

#### 2.C2.10 Tier gating summary (Watchlist)

| Capability | Free | Plus | Lock presentation |
| --- | --- | --- | --- |
| Follow instruments | 3 active (others paused) | "up to 500" (server) | Add is rolled back and the paywall opens; add retried after upgrade |
| Reorder, remove + undo, add sheet, alert shortcut | ✓ | ✓ | — |
| Automatic movement monitoring | 1 chosen instrument | all followed | Free-plan selection screen |
| Groups (create, add members) | — | ✓ | Paywall on `Novo grupo` |
| Weekly reading observations | ✓ | ✓ | — |
| Alert rule count | 2 free (copy `Crie mais de 2 alertas com o Plus.`) | unlimited | Alerts part |

#### 2.C2.11 Doc vs code (Watchlist)

- `docs/watchlist-insight-catalog.md` says "No … Activity Center is implemented here"; the code ingests watchlist insights into the Activity Center and marks them read on open.
- The doc's deterministic ranking list is now implemented as a tie-break inside the personalisation engine rather than a hard order.
- No group feature, free-plan pause model or undo receipt appears in the docs read for this slice; all three exist in code.

---

### 2.C3 Facts → insights → presentation (rules both features share)

Sources: `docs/facts-insights-presentation.md`, `docs/insight-lifecycle-phase13.md`, `docs/intelligence-privacy-phase16.md`, `docs/offline-cached-intelligence-phase17.md`, `Core/Intelligence/{FinancialFact,Insight,InsightEngine,InsightInterpretation,InsightSignificance,CachedIntelligence}.swift`.

1. **Three layers.** *Fact* = a structured, unrounded decimal measurement with its observation dates (no copy, no formatting). *Insight* = fact + type, category (market / watchlist / portfolio), period, stable id, expiry, destination and provenance (source record ids, calendar version, fetch time). *Presentation* = localised templates + number formatting at display time. Views never compute price changes.
2. **Fail closed.** Missing session, non-final price, stale fetch (> 15 min), currency mismatch, invalid ledger or unknown calendar → no fact. Never a fabricated zero, forward-filled price or partial denominator.
3. **Stable identity.** Insight id = hash of type + version + period + asset ids (or article id). A corrected source replaces the fact under the same id; consumed/dismissed receipts survive corrections.
4. **Significance tiers** (editorial, not statistical): routine < 1 % · noteworthy ≥ 1 % · significant ≥ 3 % · material ≥ 5 %; allocation is "significant" when the largest position ≥ 50 %. Watchlist/Home/Activity need ≥ noteworthy; Portfolio shows routine facts too; notifications need material.
5. **Period.** Latest completed trading week, Monday 00:00 → Saturday 00:00 Luanda, baseline = last open session before Monday; holidays per the verified BODIVA calendar.
6. **Privacy classes.** `publicMarket` (public quotes, published info) · `personalContext` (anything that reveals watchlist membership or interest) · `privateFinancial` (values, quantities, returns, weights, thresholds — even percentages). In-app with privacy mode on only `publicMarket` is shown. Portfolio insights are always private-financial; watchlist insights are personal-context.
7. **Wording guardrails.** Always say what the number is and is not: "price movement between verified closes", "constant quantities; excludes income and costs", "not a live update", "does not predict the next session", "not an intraday/annual/all-time high". No recommendation, risk score, "outperformance", or profit language for price-only comparisons.
8. **Number formatting for facts** (`FinancialPresentationFormat`): percentages 1 decimal with explicit sign; percentage points 2 decimals + ` p.p.`; currency 2 decimals; dates abbreviated in the Luanda calendar; timestamps suffixed ` · Luanda`; periods `{date} – {date}`; sub-unit values rendered as ranges (see 2.C1.14). Changing locale changes separators only, never the fact.
9. **Saved readings.** One completed reading per account and kind (portfolio / watchlist) is cached on device (encrypted at rest, excluded from backup, ≤ 2 MB, ≤ 7 days). It is shown **only while the market is closed** (closed, post-close, weekend, holiday) and only if the ledger / watchlist membership / public quote fingerprints still match; always labelled `Leitura guardada · dados de … · não atualizados em tempo real.` Cleared on sign-out and account deletion.
10. **No impression loops.** Rendering a card never consumes it; only opening the explanation or dismissing does.

---

#### Parity items (this slice)

Portfolio
- Manual ledger with buy, sell and income records per instrument — `core`
- Supported kinds: equities (whole shares), funds (fractional), bonds (nominal amount, price as % of par) — `core`
- Record editor with instrument picker (search + All/Stocks/Funds/Bonds), fees / withheld tax, date, live total, validation messages, discard confirmation, idempotent save — `core`
- Edit and delete a record (with confirmation and ledger-validity check) — `core`
- Portfolio dashboard: value, period change, missing-quote/partial-value states — `core`
- Portfolio value chart with ranges 1W/1M/3M/6M/1Y/All — `core`
- Positions list (value, return vs cost, quantity) sorted by value — `core`
- Position detail (average price, invested, gain/loss, realised gain, net income, per-position records) — `core`
- Weighted-average-cost calculation of cost basis, unrealised and realised P/L — `core`
- Full records history list — `standard`
- Allocation view (top 5 + Other, weights, progress bars) — `standard`
- Summary metrics (invested, current, unrealised P/L, change vs cost) — `standard`
- Empty state with "record purchase" and "simulate investment" entry — `standard`
- Loading skeleton, full-screen error with retry, refresh-error toast, pull-to-refresh — `standard`
- Privacy mode masking of all personal amounts, unitless trend chart, id-sorted holdings — `standard`
- Named portfolios: create / rename / delete, combined vs main vs named selection (Plus) — `standard`
- Cash movements (deposit / withdrawal / fee), cash balance, total value and net result (Plus) — `standard`
- Benchmark comparison against inflation, BNA rate, LUIBOR, 364-day T-bill (Plus) — `standard`
- Results by year (realised gain, net income) — `standard`
- Yearly PDF report per instrument (Plus) — `standard`
- Income calendar: upcoming and last-12-month dividends, coupons, redemptions; recorded / "record" status — `standard`
- Income totals for next/last 12 months (Plus) — `standard`
- Payment-day local reminders at 09:00 Luanda (Plus) — `platform-specific` (local scheduled notifications; Android: AlarmManager/WorkManager notification; web: none or email)
- CSV export of the ledger (semicolon, decimal comma) — `standard`
- CSV import with tolerant parsing, per-row review and duplicate detection — `standard`
- Statement reader: on-device OCR of a photo/PDF into the import review (Plus) — `platform-specific` (Vision/PDFKit; Android: ML Kit text recognition + PdfRenderer; web: likely omit or client-side OCR)
- Read-only share links to a portfolio, list and revoke, limit 20 (Pro) — `standard` (needs the web page `/partilha/{token}`)
- Weekly reading tiles in Portfolio (weekly price change, breadth, strongest/weakest contributor, largest position, issuer/sector weight) — `standard`
- Portfolio insight detail sheet with included positions, sources and limits — `standard`
- Saved (cached) reading shown only while the market is closed, with "saved" label — `standard`
- Tier lock → paywall → resume the interrupted action after upgrade — `standard`
- Contextual store-review trigger after saving a new record — `platform-specific` (StoreKit review; Android: Play In-App Review)
- Share sheets for CSV/PDF/link — `platform-specific` (system share; Android: Sharesheet/FileProvider; web: download/copy link)

Watchlist
- Follow / unfollow instruments; signed-in, server-synced list — `core`
- Watchlist rows with logo, symbol, name, price, % change, "price unconfirmed" state — `core`
- Add-instruments sheet with search and "all added"/"no results" states — `core`
- Empty state, loading skeleton, load-failure placeholder with retry — `standard`
- Manual drag reordering persisted per account — `standard`
- Swipe to remove with untimed undo bar restoring position and alert settings — `standard`
- Per-row alert shortcut (bell with active-rule count; leading swipe) and header active-alert count — `standard`
- Groups: create / rename / delete, multi-membership via context menu, group tabs (Plus) — `standard`
- Free plan: 3 active instruments, extra ones paused not deleted, chooser screen incl. 1 automatic-movement instrument — `standard`
- Watchlist limit paywall with automatic retry of the add after upgrade — `standard`
- Notification-permission request triggered by the first add — `platform-specific` (APNs prompt; Android 13+ POST_NOTIFICATIONS; web push optional)
- Weekly reading card (strongest movement, breadth, session run, closing extreme, linked publication), max 2 — `standard`
- Observation detail with explanation, verified closes, record ids, source links — `standard`
- Dismiss observation / "not useful" / "show fewer of this type" / reset preference — `standard`
- Device-local novelty receipts (56 days) so opened/dismissed observations do not return — `standard`
- Privacy mode hides the weekly reading card — `standard`
- Accessibility layout for large text (stacked row, labelled alert button), VoiceOver labels/hints — `standard`
- Selection haptics on add/remove — `platform-specific` (Android: HapticFeedbackConstants; web: none)
- Watchlist pushed from Home with back button and hidden tab bar — `standard`

<!-- Part 02d — Weekly Wrap, News, Learn, Notifications / Activity Center. Source: iOS snapshot origin/main 1.1.5. Paths are relative to the snapshot root. -->

> **Conventions for this part.** Copy is quoted as `PT` (EN). Strings live in `Invest.AO/Resources/Localizable.xcstrings` (source language `pt`, `en` translations). Most keys are semantic dot-keys (`weeklyWrap.stage.titleWeekly`), about a quarter are literal Portuguese sentences used as keys; both styles appear in this slice. All dates/times in this slice are rendered in **Africa/Luanda** (`Calendar.market`, Gregorian, week starts Monday — `Core/Market/Domain/Models/MarketSnapshot.swift:265`) unless stated. `UNVERIFIED` marks anything not confirmable from code.
>
> **Tier gating for the whole slice: none.** No file under `Features/WeeklyWrap`, `Features/News`, `Features/Learn`, `Features/Notifications` or `Core/Intelligence/Activity*` references `SubscriptionStore`, `isPlus`, `isPro` or `FreePlanLimits` (grep-verified). The only tier-related fact touching this slice is server-side: `DailyCloseFacts` documents that the watchlist counts in the daily-close notification "are present for Plus members" (`Core/ProductVoice/DailyCloseCopy.swift`). Wrap and Activity Center are remotely switchable through intelligence feature controls (`weekly_wrap`, `activity_center` in `Core/Intelligence/IntelligenceFeatureConfiguration.swift`), which is a rollout/kill switch, not a paywall.

### 2.10 Weekly Wrap ("Market Wraps")

**Purpose.** A full-screen, story-style recap ("Spotify Wrapped"-like) of a completed market period for a signed-in user: what happened to their portfolio, their watchlist, their own browsing interest, and a verified sample of BODIVA equities. It only states facts backed by verified closing prices; missing data is omitted, never estimated or zero-filled. The first successful generation is frozen as an immutable, account-scoped snapshot and replayed identically afterwards.

**Kinds.** `weekly`, `monthly`, `yearly` (`Features/WeeklyWrap/Data/WeeklyWrap.swift`). All three flow through the same loader/player and have kind-specific copy. Only **weekly** gets: the Home feature card, the durable history archive, edition/correction metadata, the "Dados e método" sheet, Activity Center rows and deep links. Whether the backend currently schedules monthly/yearly releases is `UNVERIFIED` (the client simply renders whatever `get_available_market_wraps` returns).

#### Availability, eligibility and entry points

| Rule | Value | Source |
| --- | --- | --- |
| Who schedules a release | The server. RPC `get_available_market_wraps` returns `periodType`, `startsOn`, `endsOn`, `availableAt`, `expiresAt`. The client never invents a release window. | `SupabaseMarketRepository.fetchAvailableWrapPeriods`, `SupabaseMarketMapping.makeWrapPeriod` |
| Client validation of a window | `firstDay <= lastDay`; `availableAt >= start of firstDay`; `expiresAt > availableAt`; **window length ≤ 72 h**. Invalid rows fail decoding. | `SupabaseMarketMapping.swift:40` |
| When it appears (documented server behaviour) | 20 min after the scheduled close: weekly on Friday (or the last open session's close + 20 min if Friday is closed; a week with no sessions has no release), monthly on the last trading session of the month, yearly on the last session strictly before 25 December. `UNVERIFIED` client-side — it is server policy described in `docs/weekly-wrap.md`. | docs |
| Period shape | `start` = Monday 00:00 Luanda, `endExclusive` = day after server `endsOn`. Key = `weekly-YYYY-MM-DD` (Monday). | `WeeklyWrapPeriod.key` |
| Visible on Home | `availableAt <= now < expiry`, where weekly expiry = `min(expiresAt, next Monday 00:00 Luanda)`; monthly/yearly expiry = `expiresAt`. Replaying never extends the window. | `WeeklyWrapPeriod.isVisibleOnHome` |
| Home feature card shown only when | market state ∈ {post-close, weekend, holiday, closed}; weekly period starting this or the previous week; a generated Wrap exists with `stories.count > 2`. | `Core/Intelligence/HomeContextResolver.swift:78,184` |
| Auth | **Sign-in required.** Signed-out: `Inicia sessão para ver o teu Wrap.` (Sign in to view your Wrap.). A Wrap push/deep link while signed out opens the sign-in sheet. | `WeeklyWrapView.prepare`, `HomeView.resolveWrapRoute` |
| Needs portfolio? watchlist? | Neither. A user with no holdings and no watchlist still gets a market-only story if verified market observations exist. At least one story besides the opening is required, otherwise "not enough data". | `VerifiedWeeklyWrapService.make` (`guard stories.count > 1`) |
| Tier | None (free for all signed-in users). | — |

Entry points:

1. **Home context card** (`Features/Home/Components/HomeContextCard.swift`, rules in `HomeContextResolver.wrapFeature`). One of three variants, in priority order:
   - Portfolio: eyebrow `A TUA SEMANA · {d MMM – d MMM}` (YOUR WEEK · …), headline `As tuas posições variaram {±x,xx%} na semana` (Your positions changed by … this week), detail `Variação de preço das posições iniciais, entre fechos verificados.`, action `Ver o meu Wrap` (View my Wrap). Hidden in Privacy Mode.
   - Watchlist: eyebrow `NA TUA LISTA · {period}`, headline `{SYMBOL} variou {±x,xx%} esta semana`, detail `Maior variação da tua lista entre fechos verificados.`, action `Ver o meu Wrap`. Hidden in Privacy Mode.
   - Market: eyebrow `FECHO DA SEMANA · {period}`, headline `{rises} de {count} títulos observados subiram`, detail `Amostra com fechos verificados; não representa um índice BODIVA.`, action `Ver o Wrap` (View Wrap).
2. **"Resumos disponíveis" (Available summaries) menu** on Home (`HomeRecapsMenu`): lists every other currently visible period as `{A tua semana no mercado | O teu mês no mercado | O teu ano no mercado} · {d de MMMM – d de MMMM}`.
3. **Activity Center row** `O seu Weekly Wrap está pronto` (see 2.x Notifications): dismisses the inbox sheet then opens the Wrap.
4. **Push notification** with `category = weekly_wrap` + `wrap_period`, and **deep link** `investao://wrap/weekly-YYYY-MM-DD` (strict: scheme `investao`, host `wrap`, exactly one path component, 17 chars, valid date that is a Monday; no query/fragment/userinfo — `WeeklyWrapDeepLink.swift`).
   - A stored snapshot for that key opens even after the release window ended and **offline**.
   - No snapshot: the client refreshes `availableWrapPeriods`; if the key is not currently visible it shows an alert: title `Wrap indisponível` (Wrap unavailable), message `Este período já terminou ou não foi possível confirmar a sua disponibilidade. Tenta novamente mais tarde.`, button `OK`.

Presentation: always a **full-screen cover**, forced **dark** colour scheme regardless of app theme (`WeeklyWrapView`: `.preferredColorScheme(.dark)`). Dismissing updates Home's "completed" state and consumes the watchlist insights the Wrap already told (`HomeView.updateViewedWraps`).

#### Screen: Wrap container (`Features/WeeklyWrap/WeeklyWrapView.swift`)

| State | What is shown |
| --- | --- |
| Loading | Centered spinner with `A preparar a tua semana…` / `A preparar o teu mês…` / `A preparar o teu ano…` (Preparing your week/month/year…). |
| Loaded | The player (below). |
| Unavailable | `ContentUnavailableView` icon `calendar`, title `Wrap ainda indisponível` (Wrap not available yet), a reason message (table below); `Fechar` (Close) top-right; prominent `Tentar novamente` (Try again) at the bottom. |
| Account changes while open | Wrap is cleared and the cover dismisses. |

Unavailable reasons (all from `WeeklyWrapView.prepare`):

| Cause | PT (EN) |
| --- | --- |
| Signed out | `Inicia sessão para ver o teu Wrap.` (Sign in to view your Wrap.) |
| Monthly/yearly window expired | `Este Wrap já terminou. O próximo estará disponível após o fecho semanal.` (This Wrap has ended. The next one will be available after the weekly close.) |
| No verified previous close (baseline) | `Ainda não há um fecho anterior verificado para comparar este período.` |
| Market catalogue refresh failed | `Não foi possível atualizar o catálogo do mercado. Tenta novamente quando a ligação estiver disponível.` |
| No story qualifies | `Ainda não há fechos verificados ou atividade suficiente. Os dados em falta não são estimados.` |
| Watchlist membership could not be confirmed | `A lista ainda não está confirmada. Tenta novamente; nenhum Wrap parcial foi guardado.` |
| Portfolio still loading | `A carteira ainda está a ser atualizada. Tenta novamente dentro de instantes.` |
| Old week with no saved snapshot | `Não há uma versão guardada deste período. Um Wrap antigo não é reconstruído com a carteira ou a watchlist de hoje.` |
| Snapshot withdrawn | `Este Wrap está indisponível: {reason}` |
| Anything else (network, feature switched off, decoding) | `Não foi possível obter os dados verificados. Tenta novamente quando a ligação estiver disponível.` |
| Default before first attempt | `Ainda não há fechos verificados suficientes para contar este período.` |

Generation order (`VerifiedWeeklyWrapLoader.load`): return the archived weekly edition if one exists (no network needed) → otherwise refresh feature controls → refuse if the week is no longer in its release window → force-refresh the market catalogue → load portfolio → fetch evidence (`get_market_period_evidence`, contract v3 with calendar snapshot) → sync activity counters → capture confirmed watchlist membership → build stories → freeze voice titles → persist → return. A Wrap is only saved after every step succeeds.

#### Screen: Player (`WeeklyWrapPlayer.swift`)

Layout, top to bottom, 24 pt horizontal padding over an animated backdrop:

1. **Progress strip** — one capsule per story (3 pt high, 5 pt gaps, white 20 % track, white fill). Completed segments full, current fills with the story clock, future empty. Opening shows 0 %, final shows 100 %. VoiceOver: `Página {n} de {total}` (Page n of total), value `{p} por cento`.
2. **Header row** — left: kind badge `WEEKLY WRAP` / `MONTHLY WRAP` / `YEARLY WRAP` (caption2 bold, tracking 2.5, secondary colour; English in both locales). While paused or held it cross-fades (0.16 s) to a pause icon + `Em pausa` (Paused) without moving anything. Right, icon-only buttons, each 40 × 44 pt, 16 pt medium symbols:

   | Button | Icon | Label (a11y) | Visibility |
   | --- | --- | --- | --- |
   | Privacy Mode toggle | eye (shared `PrivacyModeButton`) | — | always |
   | Pause / resume | `pause.fill` / `play.fill` | `Pausar reprodução` / `Retomar reprodução` | hidden on opening and final |
   | Sound | `speaker.wave.2` / `speaker.slash` | `Silenciar` / `Ativar som` | always |
   | Data and method | `info.circle` | `Dados e método` | weekly only |
   | Share video | `square.and.arrow.up` | `Partilhar vídeo do Wrap` | hidden on final (final has the big button) |
   | Close | `xmark` | `Fechar Wrap` | always |
3. **Stage** — the current story (scrollable if it overflows, e.g. large text).
4. **Bottom action** — only on two pages: opening → primary button `Ver o meu Wrap` (View my Wrap); final → primary button `Partilhar` (Share) with share icon. Intermediate pages have **no** button (the "secondary Continue button" in `docs/weekly-wrap.md` is not in the code).

Interaction:

| Gesture / control | Behaviour |
| --- | --- |
| Tap left 33 % of the stage | Previous story. |
| Tap elsewhere | Next story — **except on the opening**, where tapping does nothing; the user must press `Ver o meu Wrap` (or swipe). |
| Horizontal swipe (≥ 35 pt, more horizontal than vertical) | Left = next, right = previous (works on the opening too). |
| Press and hold (≥ 0.18 s) | Pauses the clock while held; header shows `Em pausa`. |
| Pause button | Explicit pause; survives manual navigation; navigating while paused shows the destination fully revealed with no transition; returning to page 0 clears the pause. |
| Auto-advance | After the story's reading duration, moves to the next story. Never leaves the opening on its own; holds on the final story. |
| VoiceOver custom actions | `Página anterior` / `Página seguinte`. |
| Privacy Mode toggled | Playback resets to page 0 and the story list is re-filtered (see Privacy). Animations disabled while private. |
| Sheet open / share overlay / app inactive / audio interruption | Clock stops; an audio interruption also sets explicit pause. |

Timing (`WeeklyWrapStage.swift` `readingDuration`, `WeeklyWrapMotion.swift`):

- Reading duration: **8 s** for portfolio, summary (and legacy market index); **7.5 s** for market rise, market fall, watchlist highlight; **7 s** for everything else. **+4 s** when Dynamic Type is an accessibility size.
- The clock ticks every 33 ms, starts only after the page transition settles, and caps each tick at 0.1 s so a stall cannot skip a reveal.
- Each story has a `heroTime` (main number appears, 0.5–1.46 s) and `detailTime` (supporting text, 1.15–2.0 s); a haptic + tone fires at `heroTime + 0.46 s` (breadth +0.55, summary +0.4).
- Page transitions: per-destination spring (0.38–0.48 s, bounce 0.04–0.12); travel ≤ 40 pt, scale ≤ 5 %; backward navigation mirrors it. No rotation, depth or blur.

Accessibility behaviour in code: with **Reduce Motion or VoiceOver** every page renders fully revealed (no transitions, no reveal cue) — but the clock still runs and **auto-advance still happens** (`runClock` has no VoiceOver/Reduce Motion guard). `docs/weekly-wrap-phase1.md` says auto-play is disabled for VoiceOver/Reduce Motion/accessibility sizes and `docs/weekly-wrap.md` says VoiceOver uses manual navigation: **code disagrees with docs** (runtime behaviour `UNVERIFIED`).

Resume: the last story ID is persisted per account/edition, but the player always starts at page 0 (`@State current = 0`; nothing reads the cursor). Docs claim "reopening an unfinished Wrap resumes there": **not implemented in the UI**.

#### Story sequence (`WeeklyWrapStory`, `VerifiedWeeklyWrapService.make`, `WeeklyWrapPersonalization.ordered`)

Every story page shares one frame: chapter marker (a tinted capsule, 28 × 3 pt when the story opens a chapter, else 14 × 3, plus an upper-case chapter label) → optional "voice" title (title2 semibold, frozen at generation from the product-voice catalogue, family `wrap`: `O mercado, pelos números`, `Vamos ver o que mexeu 👀`, `A tua lista, ao fecho`, `A tua carteira, pelos números`) → story content → period range caption `{d de MMMM} – {d de MMMM}` at the bottom. Tint = green/red by sign for movement stories and portfolio, otherwise accent (portfolio becomes accent in Privacy Mode).

Final order: **opening → portfolio → portfolio contributor → watchlist → market breadth → up to 3 highlights (watchlist highlight / market rise / market fall, ranked by the personalization engine) → personal stat → summary.** Each is conditional except opening and summary. (`docs/weekly-wrap-phase1.md` lists a different order; code wins.)

| # | Story id | Chapter label | Headline | Content and formatting | Included when |
| --- | --- | --- | --- | --- | --- |
| 1 | `opening` | `A SEMANA EM MOVIMENTO` (monthly `O MÊS EM MOVIMENTO`, yearly `O ANO EM MOVIMENTO`) | Two-part hero, 57 pt heavy: `A tua\nsemana.` (primary colour) then `O teu\nmercado.` (accent) | Tagline `Os movimentos. Os destaques.\nA tua perspetiva.` (title3, secondary). Button `Ver o meu Wrap`. | Always. |
| 2 | `portfolio` | `A TUA CARTEIRA` | `A tua carteira.\nEsta semana.` | Percentage, 76 pt heavy rounded, monospaced, green/red, 2 decimals, always signed (`+4,80%`). Note `Variação de preço das posições mantidas. Não inclui rendimentos, comissões ou entradas de dinheiro.` Then start value and `→ end value` in AOA with 0 decimals (privacy-masked). Caption `Fechos de {d de MMMM} e {d de MMMM}`. | A verified fixed-position price return exists: quantities held immediately before Monday; **no buy/sell inside the week**; every position has complete verified closes on the same boundary dates; AOA equities/funds only; start value > 0. |
| 3 | `portfolioContributor` | `A TUA CARTEIRA` | `Quem mais\ncontribuiu` | Leading symbol (58 pt heavy); signed AOA contribution (title semibold, green/red); caption `Contributo estimado para a variação da carteira`. If a different weakest contributor exists: `Menor contributo: {SYMBOL}` + signed AOA amount. | Portfolio story exists and leading or weakest contribution ≠ 0. |
| 4 | `watchlist` | `A TUA LISTA` | `O mercado,\npela tua lente.` | Count, 112 pt heavy rounded accent, with `ativo que acompanhas` / `ativos que acompanhas`. Proportional three-colour bar (green/red/grey) + `{n} subiram · {n} desceram · {n} sem alteração`. | A qualified watchlist-breadth insight: **every** currently watched security has a complete verified movement (rule text elsewhere in the app: at least two securities and an absolute movement ≥ 1 %). |
| 5 | `marketBreadth` | `O MERCADO` | `As ações\nda semana` (`do mês` / `do ano`) | Three bars growing from the bottom (max 110 pt), each with a 42 pt count: `Subiram` (green), `Desceram` (red), `Sem alteração` (grey). Caption weekly: `{n} ações com todos os fechos verificados. Esta amostra não representa todo o mercado.`; monthly/yearly: `{n} ações com pelo menos dois fechos comparáveis`. | A verified market summary exists for listed equities. |
| 6a | `watchlistHighlight` | `A TUA LISTA` | `O maior movimento\nna tua lista` | Mini line chart first (100 pt, 4 pt stroke, end-point dot, no axes), symbol (44 pt heavy), percentage, `{start} → {end}` prices, `Fechos de … e …`. | A qualified watchlist-movement insight (largest absolute move, ≥ 1 %). |
| 6b | `marketRise` | `OS DESTAQUES` | `Uma subida\nem destaque` | Symbol, percentage (wipes upward), mini chart, `{start} → {end}`, `Fechos de … e …`. | Strongest rising verified equity exists. |
| 6c | `marketFall` | `OS DESTAQUES` | `Uma descida\nem destaque` | Same, percentage wipes downward. | Strongest falling verified equity exists. |
| 7 | `personalStat` (most viewed) | `O TEU RADAR` | `O teu interesse\nem destaque` | Symbol (64 pt heavy, accent) + `Abriste este ativo {n} vezes, em pelo menos dois dias deste período.` | Same asset opened **≥ 4 times on ≥ 2 days** inside the period. |
| 7 | `personalStat` (explorer) | `O TEU RADAR` | `O teu radar\ndo mercado` | Count (112 pt) + `ativos diferentes passaram pelo teu radar`. | Otherwise, **≥ 4 distinct assets** viewed in the period. |
| 8 | `summary` | `A SEMANA É TUA` (`O MÊS É TEU` / `O ANO É TEU`) | `A minha semana\nno mercado 🇦🇴` (`O meu mês…` / `O meu ano…`) | Ledger rows that assemble one by one (0.32 s apart), each "label … value" over a hairline: `Carteira` → portfolio %; `{SYMBOL} · watchlist` → %; `Ativos acompanhados` → count; `Indicador invest.ao` → % (see note). Then `A próxima semana\ntraz uma nova história.` (`O próximo mês…` / `O próximo ano…`) and `invest.ao`. Button `Partilhar`. | Always last. |

Notes:

- A legacy `marketIndex` story (`O MERCADO` / `Esta semana\nno mercado`, 125 pt chart, rolling-digit percentage, caption `Variação entre os fechos observados.`, disclaimer `Indicador invest.ao; não é um índice oficial da BODIVA.`) is still rendered by the stage but **never produced** by the current verified service (`indexChange: nil`). Consequently the `Indicador invest.ao` ledger row never appears today.
- Move prices use 2 decimals, 6 if the smaller price is < 1, 8 if < 0.0001, in the security's currency.
- Tiny non-zero percentages are never rounded to zero: they render as `Entre 0% e +0,01%` / `Entre −0,01% e 0%` (`FinancialPresentationFormat.percentage`).
- Percentage formula: `100 × (end_close − baseline_close) / baseline_close` where baseline = final close of the last open session **before** the week, end = final close of the last open session in the week. All intermediate sessions need a verified final observation; a security that did not trade or misses one session has no fact. Unchanged = 0 % only when all observations exist.
- Watchlist stories use **current** membership at generation time (historical membership is not recorded).
- Personal-stat activity is counted within the period bounds supplied by the server; `docs/weekly-wrap.md` says weekends are excluded for weekly Wraps, but the client applies no weekend filter (`PersonalisationStore.snapshot`) — `UNVERIFIED` which holds in production.

Omissions recorded with the Wrap (shown in the data sheet): portfolio had transactions in the week; portfolio lacks complete comparable closes; some watched assets lack complete closes; the equity sample is partial.

#### Motion, sound and haptics

| Element | Rule |
| --- | --- |
| Backdrop | App background + diagonal gradient of the story tint at 12 % from the top-right + one decorative mark (380 pt, 55 % opacity, top-right) per story family: concentric ribbons (opening), ruled lines (portfolio / contributor / radar / index), vertical bands (breadth / rise / fall / watchlist), focus rings (watchlist highlight), outlined cards (summary). Decorative motion runs 4× faster than the story clock so it settles before the number lands. |
| Reveals | Seven styles: lift, wipe up, wipe down, wipe across, focus (scale 0.92→1), stamp (1.08→1), fade; springs 0.35–0.5 s. Numbers use native rolling-digit transitions. |
| Soundtrack | Bundled `weekly-wrap-theme.mp3` (2.7 MB; duration `UNVERIFIED`), looped, volume 0.14, ducked to 0.06 under cues. Starts when the Wrap opens. |
| Cues | Synthesised sine tones: page turn 420→560 Hz, 0.13 s; reveal 660 Hz, 0.2 s; final reveal 660→880 Hz, 0.32 s. The **same neutral cue for gains and losses** (no celebration of returns). |
| Haptics | Soft impact (0.35) on page turn; light impact on reveal (0.45, final 0.65). |
| Audio session | Ambient, mixes with the user's music, respects the silent switch. Paused on background/interruption, resumed only if still enabled. |
| Sound toggle | Defaults to **on at every open** (`@State soundEnabled = true`). `docs/weekly-wrap.md` says it is remembered: **code disagrees**. |

#### Privacy Mode inside the Wrap

- Story classes (`Core/Privacy/IntelligencePrivacy.swift`): `portfolio`, `portfolioContributor` = private financial; `watchlist`, `watchlistHighlight`, `personalStat` = personal context; `opening`, `marketBreadth`, `marketRise`, `marketFall`, `summary` = public market.
- With Privacy Mode on, **private and personal stories are removed from the sequence entirely** (in-app policy allows public only); the summary ledger drops portfolio and watchlist rows; voice titles for non-public chapters are hidden. (The `••••` placeholder and `Contributo oculto` strings exist in the stage but are unreachable through the player because those stories are filtered out.)
- The data sheet hides positions (`Posições ocultas no Modo de privacidade.`), correction text and personal omissions.

#### Sheet: Data and method — `Dados e método` (`WeeklyWrapDataDetails.swift`, weekly only)

Navigation title `Dados e método`, close button top-left. Sections in order:

1. Title `O que esta semana compara` (What this week compares).
2. `A variação de preço compara o último fecho antes da semana com o último fecho desta semana, normalmente sexta-feira. Cada sessão intermédia precisa de uma observação final verificada. Sem negociação ou sem fecho fiável, o ativo fica de fora.`
3. `A carteira usa quantidades mantidas no início da semana. Compras e vendas durante a semana impedem a comparação da carteira; dinheiro investido não é ganho. Rendimentos, comissões e impostos não entram nesta métrica.`
4. `Gerado em {date, time}. Esta versão fica guardada para o período.`
5. `Edição {n} · {snapshot UUID}` (selectable). If corrected: `Dados corrigidos: {explanation}` and `Substitui {UUID}`. If personalization was recreated: `Personalização recriada com a lista confirmada em {d de MMMM de yyyy, HH:mm}.` + `Os fechos pertencem à semana original. A lista reflete a data da recriação; os restantes capítulos foram preservados.`
6. Edition switches: `Ver edição original` (when edition > 1) / `Ver edição atual` (while viewing the original).
7. **Recreate personalization** — heading `Recriar a personalização`, explanation `Cria uma nova edição usando a lista atual e fechos verificados da semana original. A edição original continua disponível. A carteira e os capítulos do mercado ficam preservados.`, button `Recriar com a lista atual`, progress `A verificar a lista e os fechos da semana…`. Result messages: `Nova edição guardada. A edição original continua disponível.` / `Esta edição já usa a mesma lista e os mesmos fechos verificados.` / `Não foi possível confirmar a lista atual. Tenta novamente; a edição guardada foi preservada.` / `Há uma edição mais recente. Abre a edição atual e tenta novamente.` / `Esta versão não tem contexto suficiente para recriar a personalização. A edição guardada foi preservada.` / `Não foi possível verificar todos os fechos e o calendário da semana original. Tenta novamente quando esses dados estiverem disponíveis. A edição guardada foi preservada.` / `Não foi possível abrir essa edição guardada.` Only the two watchlist chapters are replaced; the watchlist capture must be < 15 min old.
8. Legacy note (migrated snapshots): `Versão preservada do arquivo anterior. O contexto de composição não foi registado nessa versão.`
9. Pinned contracts: one line each `{calculation id} · v{version}`.
10. `Posições usadas` (Positions used): `{security id} · {quantity} unidades` + `Insight {id} · transações {ids}`.
11. `Dados omitidos` (Omitted data): the four omission sentences (`A carteira teve compras ou vendas; não se atribuiu o fluxo a desempenho.` / `A carteira não tem fechos completos e comparáveis para todas as posições.` / `A lista tem ativos sem fechos completos; o resumo total foi omitido.` / `A amostra de ações não inclui todo o mercado.`).
12. `Fontes verificadas` (Verified sources): one card per insight with asset ids, calculation id/version, and per observation `{observed} · recolhido {collected} · {dataset} · parser {version} · linha {record} · lote {run} · SHA-256 {hash}`.

This is an audit surface; a rebuild may simplify presentation but must keep formulas, omissions, generation time and source provenance reachable.

#### Sharing: video export (`WeeklyWrapVideoShare.swift`, `WeeklyWrapVideoExporter.swift`, `WeeklyWrapVideoFrame.swift`)

| Aspect | Value |
| --- | --- |
| Trigger | Header share icon on any non-final page, or `Partilhar` on the final page. No preview/review step. |
| Progress UI | Dimmed overlay (black 60 %) with a rounded panel: determinate progress bar labelled `A preparar vídeo…` then `A adicionar música…` (from 90 %), and `Cancelar`. |
| Output | **MP4, H.264, 1080 × 1920, 30 fps, ~6 Mbps**, rendered from a fixed 360 × 640 pt canvas at 3×. |
| Content | **Public stories only** (`opening`, `marketBreadth`, `marketRise`, `marketFall`, `summary`). Portfolio, watchlist, activity stories and all monetary amounts never enter the video. With no personal fields the summary ledger is empty in the video. |
| Duration | Sum of each included story's reading duration (7 + 7 + 7.5 + 7.5 + 8 = **37 s max**; fewer stories → shorter). Reveals are driven by video time, independent of device text size (fixed at Large) and playback controls. |
| Frame chrome | Static progress capsules (current and past filled), `invest.ao` + kind badge, chapter label, story content, period range, edition marker (`Edição {n}` or `Dados corrigidos · edição {n}`), and `Lista confirmada em …` when recreated. Dark theme, app language. |
| Audio | Theme looped to cover the whole video at volume 0.14 with a **1 s fade in and 1 s fade out**. No cue tones. |
| Hand-off | Native share sheet with the file. `wrap_shared` is recorded only when the share activity actually completes. |
| Cancellation | Cancel button, toggling Privacy Mode, account change, or leaving the app before the sheet opens cancels and deletes temporary output. Temp files use complete file protection and are deleted when sharing ends. |
| Failure | Alert `Não foi possível preparar o vídeo` (Could not prepare the video), `OK`. Also shown if the edition being shared is no longer the account's current edition (superseded/withdrawn). |

**Share card image:** `WeeklyWrapShareCard.swift` defines a branded 540 × 960 pt (1080 × 1920 px at 2×) still: `invest.ao` + badge, title `A minha semana\nno mercado 🇦🇴`, `{d de MMMM} – {d de MMMM} · {yyyy}`, edition marker, a featured block (upper-case title, 94 pt percentage, detail) or fallback `AÇÕES COM FECHOS VERIFICADOS` + count + `Amostra observada nesta semana`, or `ATIVOS QUE ACOMPANHO` + count; a metric ledger (`Indicador invest.ao`, `{SYMBOL} · watchlist`, `Carteira`, `Ativos acompanhados`); disclaimer; footer `O teu mercado, de perto.` + `invest.ao`. **It is only referenced by the design-system gallery; the shipped share flow is the video.** The opt-in toggles described in `docs/weekly-wrap-phase1.md` ("include portfolio percentage", "include watchlist details") exist only as a data model (`WeeklyWrapShareOptions`) with no UI. Treat the still image and toggles as designed-but-unshipped.

#### Snapshots, archive, lifecycle

| Topic | Rule | Source |
| --- | --- | --- |
| Immutability | First successful weekly generation wins for an account + week. Reopening reads the stored edition, never today's prices, watchlist or portfolio. | `WeeklyWrapArchive.save` |
| Archive depth | **730 days (2 years)** from first generation, independent of replays; pruned on later writes. Up to 120 most recent weekly files are scanned to find the current release. | `WeeklyWrapArchive.retention`, `currentRelease` |
| Temporary cache (monthly/yearly, legacy files) | Pruned after **56 days**; cleared at sign-out. | `WeeklyWrapCache.prune`, `clear` |
| Sign-out | Temporary releases removed; the weekly **history stays** on the device (protected, account-scoped, excluded from backup). `docs/weekly-wrap.md` says sign-out clears the cache — superseded by `docs/historical-intelligence-snapshots-phase14.md`, which matches code. | `WeeklyWrapCache.clear` |
| Account deletion | Archive, playback and temp files removed; late writes rejected. | `deleteAccount` |
| Editions | Edition 1 = original. Explicit correction (source/calculation/methodology) or user-requested personalization repair appends edition N+1 and moves the "current" pointer; older editions stay readable. No automatic correction path ships. | `WeeklyWrapArchive.correct`, `repairPersonalization` |
| Local only | No cloud sync or cross-device history; reinstall loses it. | docs phase 14 |
| No history browser | There is no screen listing past Wraps; old weeks are reachable only by deep link / notification. | — |
| Lifecycle events | `wrap_available` (once per account/week, when Home first has a generated Wrap), `wrap_opened` (after content loads), `wrap_completed` (on reaching the summary), `wrap_abandoned` (dismissed before the summary), `wrap_shared`. Individual swipes are not events. | `WeeklyWrapCache.Event`, `WeeklyWrapLifecycleTracker` |
| Side effects | Opening/completing marks the Activity Center Wrap row read; completing consumes the watchlist insights already shown so they do not reappear as "new" on the Watchlist. | `ApplicationShell.swift:122`, `HomeView.updateViewedWraps` |

Doc/code disagreements summary for this feature: (1) story order; (2) auto-play under VoiceOver/Reduce Motion; (3) resume cursor not used; (4) sound toggle not remembered; (5) no intermediate Continue button; (6) PNG share card and opt-in toggles not shipped (video only); (7) weekly retention is 730 days, not 56; (8) sign-out keeps weekly history; (9) evidence RPC is `get_market_period_evidence` (contract v3), not `get_weekly_wrap_evidence`.

### 2.11 News

**Purpose.** Two public, read-only content streams: (a) **editorial publications** — articles and market recaps written in an editorial portal (`news_articles`), and (b) **market-generated updates** — short BODIVA / issuer / market notices that arrive inside the market snapshot (`MarketUpdate`). No sign-in and no tier required to read. Read/unread styling and "mark as read" side effects need a signed-in account.

Entry points: Home `Notícias` section (up to 3 cards) and Home `Mercado` updates section (up to 3 rows); Markets tab rows `Notícias` → news archive, and `Informação de mercado` card → market information screen (only when the snapshot has updates); Activity Center, Watchlist insight details, Saturday Discover and push notifications → article detail.

#### Component: Publications section — `NewsArticlesSection` (Home, Market information)

- Header `Notícias` (News) with trailing link `Ver tudo ↗` (View all) → news archive. Header and link stack vertically when they do not fit.
- Shows **only publications from today and yesterday (Luanda calendar days)**, newest first, **maximum 3** (`NewsFeedStore(homeSummariesOnly: true)`, `NewsArticle.publicationWindow`).
- Each item is a **featured card** (elevated surface, large radius, 24 pt padding): metadata line → title (large numeric/"asset price" type style) → summary (3 lines; unlimited at accessibility sizes) → `Ler artigo ↗` (Read article) or `Ler recap ↗` (Read recap).
- Auto-refreshes every **60 s** while the app is active.

| State | UI |
| --- | --- |
| Loading (nothing yet) | Skeleton card (4 placeholder bars); a11y label `A carregar artigos e recaps`. |
| Empty | Icon `newspaper`, `Ainda sem publicações` (No publications yet), `Os novos artigos e recaps aparecerão aqui.` |
| Error, nothing cached | `Publicações indisponíveis`, `Não foi possível atualizar os artigos e recaps.`, `Tentar novamente`. |
| Error with content showing | Inline row `Não foi possível atualizar as publicações.` + `Tentar novamente`. |

#### Screen: News archive — `NewsFeedView`

Navigation title `Notícias` (inline); tab bar hidden; content column max 680 pt; pull-to-refresh; auto-refresh every 60 s while active.

- **Search**: system search field, prompt `Pesquisar por título` (Search by title). 300 ms debounce; server-side case-insensitive title match over all published articles. No category/tag filter exists.
- **Sections**: `Hoje` (Today), `Ontem` (Yesterday), then one section per calendar month, titled with the capitalised month name (`Outubro`), plus the year when it is not the current year (`Dezembro de 2025`). Within a section newest first (ties by id).
- **Section body**: one card containing rows separated by hairlines. Row = metadata line → title (body; **semibold when unread, regular when read**) → summary (2 lines; unlimited at accessibility sizes). Read rows render at 65 % opacity; VoiceOver value `Lida` / `Não lida`; hint `Abre o artigo completo` / `Abre o recap completo`.
- **Paging**: 20 per page; a `Carregar mais` (Load more) button that also auto-triggers when scrolled into view; spinner while loading. A refresh re-reads everything already loaded in one request so the list does not collapse.

| State | UI |
| --- | --- |
| Loading / searching | `A carregar notícias` loading view. |
| Empty feed | Icon `newspaper`, `Ainda sem notícias` (No news yet). |
| Empty search | Icon `magnifyingglass`, `Sem resultados`. |
| Feed error | `Notícias indisponíveis` + `Não foi possível atualizar os artigos e recaps.` (or `Não foi possível carregar mais publicações.`) + `Tentar novamente`. |
| Search error | `Notícias indisponíveis` + `Não foi possível pesquisar as notícias.` + `Tentar novamente`. |

**Metadata line** (`NewsArticleMetadata`): kind label with icon (`newspaper` for articles, `chart.bar.xaxis` for recaps) · publication date `d MMM yyyy` (caption, medium, secondary; wraps to two lines if needed).

**Kinds** (`NewsArticle.kindTitle`): `Artigo` (Article); `Recap diário` (Daily recap, when linked to a market recap); `Recap semanal` (Weekly), `Recap mensal` (Monthly), `Recap anual` (Annual) from `recap_period`.

**Article fields available**: id, slug, title, summary, body (Markdown, fetched only on the detail screen), published_at, recap period / recap trading date, categories (names), sources (name, URL, optional title, primary flag), related securities (id, symbol, name). **Categories and source titles are fetched but never displayed.**

**Read state** (signed-in only): an article is "read" once it was opened on this device (personalization receipt `article:{id}`) or its Activity Center item is read. Signed-out users never see read styling.

#### Screen: Article detail — `NewsArticleDetailView`

Navigation title = kind label (`Artigo`, `Recap diário`, …; `Notícia` while loading), inline; tab bar hidden; column max 680 pt; pull-to-refresh re-fetches. **Always re-fetched by id on open** — an unpublished/archived article shows the unavailable state instead of stale content.

Sections in order:

1. Metadata line.
2. Title (screen-title style, header trait).
3. Summary (body, secondary colour).
4. Hairline.
5. Body rendered from Markdown as native text (selectable, 4 pt line spacing).
6. Hairline, header `Fontes` (Sources): one row per source — source name, caption `Fonte primária` (Primary source) when flagged, trailing `↗`. Opens in an **in-app browser sheet**. Only `http`/`https` URLs with a host and no credentials are shown or opened.
7. Header `Títulos relacionados` (Related securities): rows (logo, name/symbol, price/change as in Markets lists) → asset details. Matched by id or symbol against currently visible securities; section hidden when none match.

Toolbar: trailing `…` menu (`Opções da notícia`) → `Exportar story` (Export story).

| State | UI |
| --- | --- |
| Loading | Centered spinner. |
| No longer published | Icon `newspaper`, `Notícia indisponível`, `Esta notícia já não está publicada.`, `Tentar novamente`. The matching Activity Center item is withdrawn. |
| Load failure | Same title, `Não foi possível carregar a notícia. Verifica a ligação e tenta novamente.`, `Tentar novamente`. |

Side effects on successful load (signed-in): records the article as opened and marks matching Activity Center items read.

**Markdown subset** (`Features/News/Data/NewsMarkdown.swift`, no web view, no HTML execution):

| Block | Syntax | Rendering |
| --- | --- | --- |
| Heading | `#` … `######` + space | Levels 1–2: title2 bold; levels 3–6: headline. |
| Paragraph | Consecutive non-empty lines joined with a space | Body text. |
| Unordered list | Line starting `- `, `* ` or `+ ` (single level) | `•` + text. |
| Ordered list | `1. ` or `1) ` (single level) | Original number + text. |
| Blockquote | Line starting `>` | 3 pt accent bar on the left, secondary text. |
| Horizontal rule | `---`, `***`, `___` | Divider. |
| Inline | Bold, italic, links (Foundation inline Markdown) | Links kept only if http/https with host and no credentials; unsafe links are stripped to plain text. |

Not supported: nested lists, tables, images, code blocks, raw HTML.

#### Sheet: Export story — `NewsStoryExportSheet`

Title `Exportar story`, close button top-left, pinned bottom button `Partilhar imagem` (Share image) → `A preparar imagem…` with spinner → native share sheet.

- **Canvas**: 432 × 576 pt (3:4), exported at 2.5× = **1080 × 1440 PNG**. Background = diagonal 3-stop gradient + soft white radial glow from bottom-right. Centered 368 pt-wide rounded card (24 pt radius, 20 pt padding; white in light mode, app background in dark mode — follows the app's current colour scheme) containing the **title** (bold, ~90 % of large-title size) and, when it differs from the title, the **summary** (body, secondary). **The article body is never exported.** No logo or URL is drawn on the canvas.
- **Themes** (6): `Azul invest.ao` `#209CD5 → #477AE8 → #7761EE`; `Aurora azul` `#3878D8 → #507ADF → #75B7E8`; `Índigo` `#4666C6 → #6B64D2 → #9B83EA`; `Azul petróleo` `#15899C → #379FBC → #78BAC2`; `Amanhecer` `#7563B6 → #B37BAE → #E5ADA3`; `Azul suave` `#C9DDF2 → #91B7E0 → #5A9BFF`. The theme is **chosen automatically** by a stable hash of the article id (mod 6); there is no theme picker.
- **Text preparation**: HTML tags and entities are stripped, Markdown flattened to plain text, whitespace collapsed.
- **File name**: `investao-noticia-{slug}.png` (ASCII-folded slug, max 80 chars; falls back to the article id).
- **Cannot export**: if the title is empty → `Não é possível exportar` / `Esta notícia não tem título.`; if title + summary do not fit 512 pt of height at fixed Large text → `O conteúdo é demasiado longo para caber numa imagem sem cortar texto. A notícia continua disponível para leitura.` (share button disabled; text is never truncated).
- **Failure**: alert `Não foi possível gerar a imagem. Tenta novamente.` with `Tentar novamente` / `Cancelar`.
- Temp file uses complete file protection and is removed when the sheet closes or the account changes.

#### Screen: Market information — `MarketInformationView` (Markets tab)

Entry card on the Markets tab (`MarketInformationSummary`, shown only when updates exist): round `newspaper` icon, `Informação de mercado` + count badge, latest update title (2 lines; fallback `Atualizações da BODIVA, emitentes e títulos acompanhados.`), chevron.

Navigation title `Mercado` (large); tab bar hidden; pull-to-refresh. Sections in order:

1. Subtitle `Informação relevante sobre a BODIVA, emitentes e títulos acompanhados.`
2. Publications section (same component as Home, max 3, today/yesterday).
3. **Category chips** (horizontal scroll, capsule buttons ≥ 44 pt, selected = accent fill with on-accent text, selection haptic, 0.24 s snappy animation unless Reduce Motion): `Tudo` (All), `BODIVA`, `Emitentes` (Issuers), `Mercado` (Market), `Comunicados` (Announcements).
4. Update rows, newest first, hairline-separated. Row: 48 × 48 rounded icon tile (accent on 10 % accent) · category (body semibold, accent) · title (secondary semibold) · detail (caption) · `{source} · {HH:mm}` (caption2, tertiary) · chevron. Icons by category: BODIVA `building.columns`, Issuers `building.2`, Market `chart.line.uptrend.xyaxis`, Announcements `doc.text` (an update may carry its own icon).
5. Empty (for the selected category): icon `doc.text`, `Sem informação` (No information), `Novas atualizações de mercado aparecerão aqui.`

`MarketUpdate` fields: id, category, title, detail, timestamp, source, related security ids, optional icon, body paragraphs.

#### Screen: Market update detail — `MarketUpdateDetailView`

Navigation title = category (inline). Category (caption semibold accent) → title (large title bold) → detail (body, secondary) → `{source} · {d de MMMM, HH:mm}` (caption, tertiary) → hero icon tile (44 pt symbol, min height 120 pt, elevated surface) → body paragraphs (body, 4 pt line spacing) → `Títulos relacionados` rows → asset details.

The Home `Mercado` section (`MarketUpdatesSection`) shows the first 3 updates as the same rows inside one card and navigates to this detail.

### 2.12 Learn

**Purpose.** Seven short, static lessons explaining how the Angolan market works, bundled in the app and fully localised (PT/EN). No network, no account, no tier. Entry: Markets tab row `Aprender` (Learn) with `book.closed` icon (`Features/Markets/MarketsView.swift:316`).

#### Screen: Lesson list — `LearnView`

Navigation title `Aprender` (inline); tab bar hidden; column max 680 pt. One elevated row per lesson (12 pt gaps): lesson icon (accent, 28 pt wide) · title (secondary semibold) · green `checkmark.circle.fill` once read (a11y `Lida`) · chevron. Footer caption: `Conteúdo educativo. Não constitui recomendação de investimento.` (Educational content. Not investment advice.)

Read state: a lesson is marked read the moment it is opened; stored **on the device only** (comma-separated ids under `investao.learn.read`), not per account and not synced. No progress percentage, quiz or completion reward.

#### Screen: Lesson — `LessonView`

Lesson title (screen-title style) followed by exactly **three sections**, each a heading (section-title style) + one body paragraph (body). No navigation title text, no images, no links, no actions.

| # | id | Icon | Title PT (EN) | Section headings PT (EN) |
| --- | --- | --- | --- | --- |
| 1 | `bodiva` | `building.columns` | `O que é a BODIVA` (What BODIVA is) | `O mercado` (The market) · `Quem supervisiona` (Who supervises it) · `Como se participa` (How to take part) |
| 2 | `shares` | `chart.line.uptrend.xyaxis` | `Ações` (Shares) | `Uma parte da empresa` (A piece of a company) · `Como se forma o preço` (How the price is set) · `De onde vem o retorno` (Where returns come from) |
| 3 | `bonds` | `doc.text` | `Obrigações` (Bonds) | `Um empréstimo` (A loan) · `Preço e valor nominal` (Price and face value) · `Rendibilidade` (Yield) |
| 4 | `quote` | `chart.xyaxis.line` | `Ler uma cotação` (Reading a quote) | `Preço e variação` (Price and change) · `Volume e negócios` (Volume and trades) · `Liquidez` (Liquidity) |
| 5 | `income` | `calendar` | `Dividendos e cupões` (Dividends and coupons) | `A data ex-dividendo` (The ex-dividend date) · `Impostos` (Taxes) · `Na tua carteira` (In your portfolio) |
| 6 | `orders` | `arrow.left.arrow.right` | `Comprar e vender` (Buying and selling) | `Ordem limitada` (Limit orders) · `Custos` (Costs) · `Regista na carteira` (Track it in your portfolio) |
| 7 | `risk` | `scalemass` | `Risco e diversificação` (Risk and diversification) | `Os preços variam` (Prices move) · `Concentração` (Concentration) · `Prazo` (Time frame) |

Lesson bodies (PT source; EN exists for every string under `learn.{id}.{1-3}.body`):

| Lesson | § | Body (PT) |
| --- | --- | --- |
| bodiva | 1 | A BODIVA (Bolsa de Dívida e Valores de Angola) é o mercado regulamentado onde se negoceiam ações, obrigações do Tesouro e obrigações de empresas. |
| bodiva | 2 | A Comissão do Mercado de Capitais (CMC) regula e supervisiona o mercado, as empresas cotadas e os intermediários. |
| bodiva | 3 | Não compras diretamente na bolsa. As ordens passam por um agente de intermediação registado na CMC, como um banco ou uma sociedade corretora, onde abres uma conta de valores mobiliários. |
| shares | 1 | Uma ação é uma fração do capital de uma empresa. Quem a detém partilha os resultados e os riscos do negócio. |
| shares | 2 | O preço resulta dos negócios entre compradores e vendedores. Sobe quando há mais procura do que oferta ao preço atual e desce no caso contrário. |
| shares | 3 | O retorno vem da variação do preço e dos dividendos que a empresa decida distribuir. Nenhum dos dois é garantido. |
| bonds | 1 | Ao comprar uma obrigação emprestas dinheiro ao Estado ou a uma empresa. Em troca recebes juros, os cupões, e o valor nominal no vencimento. |
| bonds | 2 | O preço de uma obrigação é cotado em percentagem do valor nominal. Abaixo de 100% compras com desconto; acima, com prémio. |
| bonds | 3 | A rendibilidade até ao vencimento junta os cupões e a diferença entre o preço pago e o valor reembolsado. Na ficha de cada obrigação podes calculá-la para o preço que escolheres. |
| quote | 1 | O preço mostrado é o do último negócio. A variação compara-o com o fecho da sessão anterior. |
| quote | 2 | O volume é a quantidade de títulos negociados e os negócios são o número de transações. Com poucos negócios, um só pode mover muito o preço. |
| quote | 3 | Num título pouco negociado pode demorar a encontrar quem compre ou venda. A secção Liquidez de cada ficha mostra com que frequência negoceia. |
| income | 1 | Para receber um dividendo tens de ter as ações antes da data ex-dividendo. Quem compra nessa data ou depois já não recebe esse pagamento. |
| income | 2 | Dividendos e juros podem estar sujeitos ao Imposto sobre a Aplicação de Capitais (IAC), normalmente retido na fonte. A taxa depende do título. |
| income | 3 | Em Rendimentos, na carteira, vês os pagamentos previstos dos títulos que tens. |
| orders | 1 | Numa ordem limitada defines o preço máximo de compra ou mínimo de venda. Só é executada a esse preço ou melhor e pode ficar por executar. |
| orders | 2 | Cada negócio tem custos: a comissão do intermediário, as taxas da bolsa e, muitas vezes, a custódia. Em montantes pequenos, os custos pesam mais no resultado. |
| orders | 3 | Ao registar compras, vendas e comissões na carteira, vês o resultado real de cada posição. |
| risk | 1 | O valor de ações e obrigações pode descer, e podes recuperar menos do que investiste. |
| risk | 2 | Com poucos títulos, o resultado depende de poucas empresas. Repartir entre emitentes e tipos de título reduz o peso de cada um. |
| risk | 3 | Se vais precisar do dinheiro em breve, podes ter de vender num mau momento ou sem comprador. Pensa no prazo antes de investir. |

Three lessons point at product features by name (bond yield calculator on a bond's page; the Liquidity section on each asset page; `Rendimentos` (Income) and transaction recording in the portfolio) — a rebuild must keep these references true or reword them.

### 2.13 Notifications / Activity Center

**Purpose.** The in-app inbox — "What happened that matters to me?" — a persistent, account-scoped timeline that merges server notifications (price/movement alerts, watched-security movements, listings, recaps, news, daily close, unusual activity, daily portfolio change), locally produced verified insights (watchlist, portfolio weekly performance) and Weekly Wrap availability. It is the history behind push notifications: one event = one row regardless of how many devices/deliveries it had.

#### Entry and gating

- **Home toolbar bell** (`Features/Home/HomeActivityButton.swift`): icon `bell`, or `bell.badge` when there is at least one unread item from the last 7 Luanda days. **No numeric badge.** Icon swaps with a symbol-replace transition (0.24 s, skipped under Reduce Motion). A11y label `Atividade`, value `Há atividade nova` / `Sem atividade nova`. Re-evaluated every 60 s.
- Presented as a **large sheet with drag indicator** containing a navigation stack.
- **Signed-out**: the same sheet shows the sign-in screen instead of the inbox. Auth required; no tier.
- Account change while open dismisses the sheet.

#### Screen: Activity — `ActivityCenterView`

Navigation title `Atividade` (Activity), inline. Toolbar: leading close button; trailing text button `Ler todas` (Mark all as read; a11y `Marcar movimentos como lidos` / `Marcar notícias como lidas`), disabled when the current filter has nothing unread — it marks **only the rows in the current filter**.

Pinned under the title: a two-segment control (a11y `Filtrar atividade`): **`Movimentos`** (Movements, default) | **`Notícias`** (News).

Body (scrolls, pull-to-refresh, re-evaluated every 60 s):

1. Optional status lines (caption, secondary): `Histórico guardado · última atualização em {EEE, d MMM 'às' HH:mm}.` when the server load failed but cached history is shown; a tappable retry line `Não foi possível guardar o histórico. Tentar novamente.` (local save failed) or `Algumas atualizações estão pendentes. Tentar novamente.` (server read-receipt sync pending).
2. **Day sections**, newest first: header `Hoje` / `Ontem` / `{d de MMMM}` / `{d de MMMM de yyyy}` (other years).
3. Each day is **one card**. Inside, items are grouped by category in fixed order **News → Movements → Portfolio → Watchlist**; each group starts with a tinted capsule label (icon + title on a 12 % tint):

   | Category | Label PT (EN) | Icon | Tint | Filter tab |
   | --- | --- | --- | --- | --- |
   | news | `Notícias` (News) | `newspaper` | accent | Notícias |
   | movements | `Movimentos importantes` (Significant movements) | `chart.line.uptrend.xyaxis` | comparison orange | Movimentos |
   | portfolio | `Movimentos da carteira` (Portfolio movements) | `briefcase` | comparison purple | Movimentos |
   | watchlist | `Watchlist` (hard-coded, same in both locales) | `star` | positive green | Movimentos |

   Category assignment (`ActivityCategory.init`): an insight-backed item is News if it is a publication, Portfolio if a portfolio insight, else Watchlist; a server notification of kind watched-security update → Watchlist; new market information / market recap / BODIVA update → News; otherwise by destination: article or Weekly Wrap → News, asset → Movements, portfolio insight → Portfolio, watchlist insight → Watchlist. (So "Your Weekly Wrap is ready" lives under the **Notícias** tab.)
4. **Row anatomy** (`ActivityTimelineRow`, min height 44 pt, 16 pt vertical padding, hairline between rows of the same group): title (body; **semibold unread, regular read**) → context line (secondary) → time `HH:mm` (caption) → optional `Dados corrigidos` (Corrected data). Read rows at 65 % opacity. No icon, avatar or chevron in the row. VoiceOver: combined element, value `Lida` / `Não lida`, hint `Abre a informação relacionada.`, custom action `Marcar como lida`.
5. Within a day items sort by time descending, then priority (alerts/notifications 0, Wrap 1, portfolio 2, watchlist 3), then id.

`docs/activity-center-phase5.md` describes a single list split into NEW / EARLIER with no category tabs; **the code ships a Movements/News filter with day sections and category capsules.** The NEW/EARLIER split survives only as the logic behind the bell's unread indicator.

Row actions:

| Action | Behaviour |
| --- | --- |
| Tap | Marks the item read and navigates (table below). |
| Long-press context menu | `Marcar como lida` (Mark as read; only when unread) and `Ver fontes e cálculo` (View sources and calculation; only for insight-backed rows → provenance sheet). |
| Swipe actions | **None.** No delete, archive, mute or "mark unread". |
| Pull to refresh | Reloads server notifications, re-ingests, retries pending saves and receipts. |

Tap routing (`ActivityDestination`):

| Destination | Opens |
| --- | --- |
| Asset | Asset details, pushed inside the sheet. |
| Article / recap | Article detail, pushed inside the sheet. |
| Portfolio insight | Portfolio insight explanation (embedded). |
| Watchlist insight | Watchlist insight explanation (embedded). |
| Weekly Wrap | Sheet dismisses, then the Wrap opens full-screen from Home. |
| Destination missing (asset delisted, insight pruned) | Icon `info.circle`, `Informação indisponível`, `O destino já não está disponível no catálogo atual.`, button `Atualizar`. |

States:

| State | UI |
| --- | --- |
| Loading (no cached items) | `A carregar atividade` (Loading activity). |
| Server error, nothing cached | Shared error view with retry. |
| Local history unreadable, nothing to show | Icon `clock`, `Atividade indisponível`, `Não foi possível recuperar o histórico guardado.`, `Tentar novamente`. |
| Empty | Icon `checkmark`, `Tudo em dia` (All up to date), `As atualizações relevantes aparecerão aqui.` An empty inbox is a valid, non-error state. |
| Filter empty — Movements | Icon `chart.line.uptrend.xyaxis`, `Sem movimentos`, `Os movimentos dos teus títulos e da tua carteira aparecerão aqui.` |
| Filter empty — News | Icon `newspaper`, `Sem notícias`, `As publicações e os resumos de mercado aparecerão aqui.` |
| Offline / stale | Cached timeline remains with the `Histórico guardado · …` line. |
| Privacy Mode | Non-public rows are replaced (see Privacy). |

#### What enters the inbox (`Core/Intelligence/ActivityPolicy.swift`)

| Source | Admission rule | Row title / context |
| --- | --- | --- |
| Explicit price or movement **alert rule** fired (price above/below, change above, 52-week high/low, volume above average, days without trades) | Server delivery, ≤ 28 days old, has a destination asset. | Thresholds are never shown in the inbox: `{SYMBOL} · O seu alerta de preço foi atingido` (Your price alert was triggered) / `Abra o título para consultar o alerta.` |
| **Automatic movement** (vs previous close) | Server delivery. | `{SYMBOL} · Movimento relevante` / `{SYMBOL} {subiu|caiu} {x,xx}% face ao último fecho, para {price} {Kz|%}.` |
| **Intraday movement** | Server delivery. | `{SYMBOL} · Movimento intradiário` / `{SYMBOL} {subiu|caiu} {x,xx}% em até 5 min, para {price} {unit}.` |
| **Watched-security price change** (vs previous quote) | Only if the server-supplied absolute change is **≥ 1 %**. | `{SYMBOL} · Título acompanhado` / `{SYMBOL} {subiu|desceu} {±x,xx%}, de {prev} para {cur} {unit}.` |
| **New listing** | Server delivery with valid event and security. | `Novo na BODIVA` (New on BODIVA) / `A admissão de {name} à negociação foi confirmada.` |
| **Market recap** receipt | Linked article is published within today/yesterday. | Article title / article summary. |
| **Account notifications** (server-composed: asset movement, market listing, market recap, news publication, daily portfolio change, weekly wrap, unusual activity, daily close) | Up to 200 (4 pages × 50). | Server "voice" title and body, re-rendered in the app language. Daily close: `Fecho da BODIVA` / `{n} em alta e {n} em baixa. Maior variação: {SYMBOL} {±x,xx}%.` (flat day: `Nenhuma ação mudou de preço.`), plus in-app only `Na tua lista: {n} em alta e {n} em baixa.` when watchlist counts are supplied. Unusual activity: `Atividade invulgar em {SYMBOL}` / e.g. `Negociou {x}× o volume habitual.` (full copy set under `notification.unusual.*`). Withdrawn content: `Informação indisponível` / `Não foi possível consultar esta atualização.` |
| **Weekly Wrap available** | Weekly kind, a generated verified snapshot exists, inside its server release window. | `O seu Weekly Wrap está pronto` (Your Weekly Wrap is ready) / `{d MMM yyyy – d MMM yyyy} · O que marcou a sua semana`. Already-opened Wraps enter as read. |
| **Portfolio weekly price performance** (local insight) | Verified, fresh, absolute change ≥ 1 % (per doc). | Voice title or `A tua carteira: {±x,x%}` / `Movimento das cotações · {period}`. |
| **Watchlist insights** (local): largest movement, session run, closing extreme, breadth, linked publication | Shared watchlist qualification rules; at most **3** ranked insights per ingestion (portfolio + watchlist combined). | Insight headline and context, e.g. `{SYMBOL} · {±x,x%}` / quote context with period; publication: article title / `{source} · {date}`. |

Formatting details for movement rows (`Core/Formatting/MarketNotificationPresentation.swift`): magnitude with 2 decimals; a non-zero change below 0.01 % reads `menos de 0,01`; a 0 % change reads `Há uma atualização de preço para {SYMBOL}.`; unit is `%` for bonds (prices quoted as % of face value), `Kz` for AOA movements, otherwise the currency code; prices with 0–2 decimals. Fallbacks when nothing else is available: title `Atualização de mercado`, context `Abra para consultar a informação.`

Never admitted: static allocation/concentration facts, screen-visit events, sub-1 % automatic watched movements, Discover or Week Ahead items, monthly/yearly Wrap availability.

#### Identity, read state, retention

| Topic | Rule |
| --- | --- |
| De-duplication | Items carry alias sets; any overlap merges into the existing row (keeps its id, first-surfaced time and read state). All physical deliveries of one event attach to the same row; a publication insight and a recap receipt for the same article merge. |
| Corrections | If the same insight type arrives with a different fact, the row is updated in place and labelled `Dados corrigidos`; it does not become unread again. |
| Withdrawal | After an authoritative refresh, insight rows that no longer qualify are hidden. A successfully fetched but unpublished article hides its row; a network failure does not. |
| Opening the inbox | Does **not** mark anything read. |
| Becomes read when | The row is tapped (on destination entry, so VoiceOver activation counts); `Marcar como lida`; `Ler todas`; the same destination is opened anywhere else (article loaded, Wrap opened/completed, asset viewed, insight explanation opened, notification tapped). |
| Unread again | Never. There is no "mark unread". |
| Server sync | Read receipts for server deliveries are sent optimistically and retried; failure shows the quiet `Algumas atualizações estão pendentes` line. Server receipts sync across devices; locally produced insight rows and their read state are **device-local**. |
| Visibility windows | News/recap/BODIVA-update rows: only **today and yesterday** (Luanda). Server notifications: **28 days**. Insights: until their own expiry. Wrap: until the server window expires. |
| Retention | **56 days** from first surfacing, capped at **200 items** (newest kept). Expired rows remain as invisible tombstones so they cannot return as new. |
| Unread indicator window | Unread **and** occurred today or in the previous 6 Luanda days. |
| Personal-context safety | Watchlist insight rows hide if current watchlist membership is unknown or changed; portfolio insight rows hide if the ledger changed since the fact was computed. |
| Storage | One protected JSON file per account in Application Support, atomic writes, excluded from backup. Removed on sign-out and account deletion. |
| Analytics | On-device daily counters only: `activity_center_opened`, `activity_item_opened`, `activity_item_marked_read`. Not uploaded. |

#### Privacy Mode in the inbox (`ActivityPresentation`)

Each row has a class: Wrap = personal context; insights = their own class; server notifications = the class of their composition, public for plain movement facts, otherwise private financial. With Privacy Mode on, any non-public row shows a generic title and `Conteúdo pessoal oculto no Modo de privacidade.` (Personal content hidden in Privacy Mode.). Generic titles: `Nova informação em invest.ao` (notifications), `O Weekly Wrap está disponível` (Wrap), `A leitura da semana está disponível` (portfolio), `Nova publicação de mercado` / `Nova leitura de mercado` (watchlist publication / other watchlist insight). Portfolio rows never contain quantities, monetary values or individual holdings in any mode.

#### Preferences that shape the inbox (not shown inside the inbox)

There are no settings controls in the Activity sheet itself. The related preferences live in Settings → Notifications and in the per-security alert sheet; they are listed here because their data contracts sit in `Features/Notifications/Data`:

| Preference | UI location | Values / copy | Default |
| --- | --- | --- | --- |
| Movement sensitivity | Settings → Notifications → `Movimentos da tua lista` → `Sensibilidade`; picker screen titled `Sensibilidade dos movimentos`, helper `Escolhe a sensibilidade dos avisos automáticos para os títulos que acompanhas.` | `Baixa` (Low) · `Normal` · `Alta` (High); single-select with checkmark, selecting dismisses. Numeric thresholds are server-side (`UNVERIFIED`). | Normal |
| Automatic alerts per watched security | Alert sheet for a security (covered with Alerts). | On/off per watchlist item. | Server default |
| Market recap | Settings toggle `Receber o fecho das acções` (Receive the stock market close); description `Um resumo editorial após o fecho da sessão, com os valores verificados e ligação ao artigo. Podes desligá-lo sem alterar os alertas de preços ou movimentos.`; note `O aviso no ecrã também depende da permissão de notificações do iOS. Os resumos recebidos aparecem em Notificações.` Errors: `Não foi possível carregar a preferência do resumo.` / `Não foi possível guardar a preferência. Tenta novamente.` | On/off; optimistic with rollback. | Off |
| Notification categories | Settings toggles: `Movimentos da tua lista`, `Movimentos das tuas posições`, `Variação diária da carteira`, `Novas admissões confirmadas`, `Fecho diário da BODIVA`, `Mostrar factos públicos nas notificações`. Footer: `Até cinco avisos opcionais por dia. Entre as 20h e as 8h, o radar fica em silêncio. Os valores da carteira e a tua relação com um título ficam dentro da aplicação.` Error `Não foi possível guardar as preferências. Tenta novamente.` | On/off each. | All on except daily close (off). |

Product rules stated in that footer and worth inheriting: **at most five optional notifications per day; quiet hours 20:00–08:00; portfolio values and the user's relationship to a security never leave the app** (lock-screen text is public-safe).

#### Usefulness feedback (adjacent, `docs/user-feedback-personalization-phase21.md`)

Not part of the inbox UI: only Watchlist insight details offer `Não foi útil` (Not useful), `Mostrar menos deste tipo na lista` (Show less of this type) and `Repor preferência` (Reset preference). Feedback lowers ranking (−12 exact fact, −16 family; halves every 28 days; expires after 56 days), never affects notifications or material events, is device-local, capped at 200 records, and can be cleared in Settings. Listed for completeness; owned by the Watchlist part.

#### Parity items (this slice)

- Weekly Wrap: server-scheduled weekly recap available after the Friday close for a bounded window (≤ 72 h, ends by Monday) — `standard`
- Weekly Wrap: sign-in required; works with no portfolio and no watchlist (market-only story) — `standard`
- Weekly Wrap: full-screen dark story player with segmented progress, tap-left/right, swipe, press-and-hold pause, explicit pause, auto-advance (7–8 s per story, +4 s at accessibility text sizes) — `standard`
- Weekly Wrap: conditional story set (opening, portfolio %, top/lowest contributor, watchlist breadth, market breadth sample, watchlist/market highlights, personal interest stat, summary) with omit-never-estimate rules — `standard`
- Weekly Wrap: verified-close calculation rules (baseline = last close before the week; all sessions verified; portfolio suppressed on any in-week trade) — `core`
- Weekly Wrap: immutable per-account snapshot replayed identically, offline, for 2 years — `standard`
- Weekly Wrap: "Data and method" sheet (formulas, omissions, generation time, edition, sources) — `standard`
- Weekly Wrap: recreate personalization with the current watchlist as a new edition; view original/current edition — `standard`
- Weekly Wrap: Privacy Mode removes personal/financial stories and rows — `standard`
- Weekly Wrap: looping soundtrack, neutral reveal tones, sound toggle — `standard`
- Weekly Wrap: page-turn and reveal haptics — `platform-specific`
- Weekly Wrap: share as 1080 × 1920 30 fps MP4 with music, public stories only, progress + cancel — `platform-specific`
- Weekly Wrap: Home feature card (portfolio / watchlist / market variants) and "Available summaries" menu — `standard`
- Weekly Wrap: deep link `investao://wrap/weekly-YYYY-MM-DD` and push routing, with an "unavailable" alert — `platform-specific`
- Weekly Wrap: monthly and yearly kinds through the same player — `standard`
- Weekly Wrap: lifecycle events (available, opened, completed, abandoned, shared) — `standard`
- News: Home/Market "News" section with up to 3 featured publications from today and yesterday, 60 s auto-refresh — `core`
- News: full archive grouped Today / Yesterday / by month, 20-per-page paging, pull-to-refresh — `core`
- News: search publications by title — `standard`
- News: article kinds (article, daily/weekly/monthly/annual recap) with kind label and date — `standard`
- News: article detail re-fetched on open with unpublished/unavailable state — `core`
- News: native rendering of the editorial Markdown subset with safe links only — `core`
- News: sources list with primary-source marker, opened in an in-app browser — `standard`
- News: related securities linking to asset details — `standard`
- News: read/unread styling for signed-in users — `standard`
- News: export an article as a 1080 × 1440 story image (auto theme, title + summary only) via the share sheet — `platform-specific`
- News: market information screen with category chips (All, BODIVA, Issuers, Market, Announcements) and update rows — `standard`
- News: market update detail with body and related securities — `standard`
- Learn: seven bundled three-section lessons in PT/EN with investment-advice disclaimer — `standard`
- Learn: per-device "read" checkmark — `standard`
- Activity Center: bell entry on Home with unread dot (no count) — `core`
- Activity Center: signed-in inbox sheet; sign-in prompt when signed out — `core`
- Activity Center: Movements / News filter, day sections, category groups (News, Significant movements, Portfolio movements, Watchlist) — `core`
- Activity Center: rows for alert hits, automatic/intraday/watched movements, listings, recaps, news, daily close, unusual activity, daily portfolio change, Weekly Wrap ready, watchlist and portfolio insights — `core`
- Activity Center: one row per event across devices/deliveries; in-place corrections labelled "Corrected data" — `standard`
- Activity Center: mark one as read (context menu), mark all in the current filter, auto-read when the destination is opened anywhere — `core`
- Activity Center: typed routing to asset, article, insight explanation or Wrap, with an unavailable-destination state — `core`
- Activity Center: "View sources and calculation" for insight rows — `standard`
- Activity Center: retention (56 days / 200 items), 28-day notification window, today+yesterday news window — `standard`
- Activity Center: cached history with saved-history, save-failed and sync-pending states; pull-to-refresh — `standard`
- Activity Center: Privacy Mode generic titles and hidden personal content — `standard`
- Activity Center: server read-receipt sync with retry — `standard`
- Notification preferences: movement sensitivity (Low / Normal / High) — `standard`
- Notification preferences: market recap opt-in — `standard`
- Notification preferences: six category toggles, five-per-day cap, 20:00–08:00 quiet hours — `standard`

### 2.14 First-launch introduction

Files: `Features/Onboarding/Onboarding{FlowView,Page,PageView,NavigationView,DevicePreview,…}.swift`, `docs/onboarding-introduction.md`.

**Purpose.** Three-page explanation before sign-in, shown once per device (skipped for a restored session).

| Page | Title PT (EN) | Message PT (EN) | Illustration inside the phone mock |
|---|---|---|---|
| 1 Market | `O mercado, mais perto.` (The market, closer.) | `Descobre ações, obrigações e fundos da BODIVA. Consulta preços, gráficos e detalhes.` | Market screen with indicator, chart, instrument rows |
| 2 Watchlist | `Segue o que te interessa.` (Follow what interests you.) | `Guarda os teus favoritos e recebe alertas de preços e movimentos.` | Saved instruments + `Alertas de preço` · `BAI · preço definido` |
| 3 Portfolio | `A tua carteira, com clareza.` (Your portfolio, clearly.) | `Regista as tuas compras, acompanha a evolução e explora cenários no simulador.` | `1 250 000 Kz` value, `Registo manual`, chart |

- Illustrations are offline artwork labelled `EXEMPLO ILUSTRATIVO`; sample values `65 000 Kz`, `BAI`, `Obrigações do Tesouro`. They never read account or market data and are hidden from VoiceOver.
- Controls: floating `Voltar` (Back) and `Ignorar` (Skip) at the top; a fixed pill primary button `Continuar` at the bottom; the last page's action and Skip both finish the introduction and open authentication. Horizontal swipe also pages.
- Caption under the portfolio page: `As simulações são ilustrativas. A invest.ao não executa ordens nem guarda os teus investimentos.`
- Motion: the phone bezel persists; its content slides horizontally while the phone zooms/shifts with a 0.7 s spring; captions blur-dissolve over 0.45 s; the button dims while navigation is locked. Light impact haptic on page change. Reduce Motion → fades only, no button scaling.
- Accessibility: VoiceOver reads heading + `Passo {n} de {m}`; at accessibility text sizes the phone shrinks and copy scrolls independently of the button.
- Follows the app's System/Light/Dark setting.

### 2.15 Authentication

Files: `Features/Authentication/{AuthenticationView,AuthenticationSignInSection,InvestAOBrandMark}.swift`.

**Screen (single, no email/password).**

1. App icon mark (spoken as `invest ponto ao`).
2. Title `O mercado angolano num só lugar` (The Angolan market in one place).
3. Message `Inicia sessão para guardar a tua lista de acompanhamento e os registos da tua carteira. Não liga a tua conta bancária ou de corretagem.`
4. `Continuar com Google` (Google mark + label) — native Google sign-in.
5. `Continuar com Apple` (system Sign in with Apple button; shown when enabled in the build, which it is).
6. Progress row `A iniciar sessão…` while working.
7. Link `Política de privacidade` → `https://invest.ao/policy`.

Errors surface through the global error presenter: `Não foi possível iniciar sessão`. Session expiry: `Inicia sessão novamente` / `A tua sessão terminou. Inicia sessão para continuar.` Sign-out elsewhere: `Sessão terminada neste dispositivo`.

The same view is embedded wherever a signed-out user hits an account-only surface (Portfolio tab, Watchlist tab, Activity sheet, Profile sheet, simulator).

Android/web note: providers are Google and Apple only. On Android, Google is the primary provider and Sign in with Apple needs the web-based flow; on web both are OAuth redirects. Account identity must stay shared across platforms.

### 2.16 Post-login account setup

Files: `Features/Onboarding/PostLoginOnboarding{View,Store,Persistence}.swift`, `docs/post-login-onboarding.md`.

Shown to new accounts only (accounts created before the rollout boundary bypass it). Two steps, progress label `1 de 2` / `2 de 2`, eyebrow `A TUA CONTA`.

**Step 1 — name.** Title `Como te chamas?`, message `Diz-nos como preferes ser tratado.`, field `O teu nome` (pre-filled from the provider name when available; trimmed; any Unicode; no minimum or maximum). Primary `Continuar`; secondary `Agora não` (keeps the typed text for back navigation and allows an unnamed account, which then shows as `Perfil invest.ao`).

**Step 2 — first watchlist.** Title `O que queres acompanhar de perto?`, message `Adiciona instrumentos à tua lista de acompanhamento.`
- Search field (symbol, name, issuer) and category chips (`Todos` + only categories that have instruments). Chips are navigation filters, not a saved profile.
- Default list: up to **8** instruments in name order; search covers the whole catalogue.
- Multi-select rows with logo; VoiceOver `Selecionado` / `Não selecionado`; counter `1 instrumento selecionado` / `{n} instrumentos selecionados`.
- Primary `Adicionar e continuar` (label `A guardar` while saving); secondary `Fazer isto mais tarde`.
- Errors: `Não foi possível carregar os instrumentos. Verifica a ligação e tenta novamente.`; `Não foi possível guardar os instrumentos. Tenta novamente ou continua sem os adicionar.`; partial save `Alguns instrumentos foram guardados. Tenta adicionar os restantes ou continua com os que já estão na lista.` with `Continuar sem adicionar os restantes`.
- Empty: `Sem instrumentos disponíveis` / `Podes criar a tua lista mais tarde.`; no results `Procura por símbolo, nome ou emitente, ou escolhe outro mercado.`
- The Free limit of 3 saved instruments applies here too when enforcement is on.

A sign-out affordance is available during setup: confirm `Terminar sessão?` / `Podes continuar a configuração quando voltares a entrar.` The draft (step, name, selections, filter) is saved per account and resumes after relaunch.

After setup: Home. Notification permission is **not** requested on arrival (it is asked in context: first watchlist add, first alert save, Settings). If the account is Free and plans are available, the paywall opens once with reason `Acompanha mais oportunidades e compara com mais liberdade.`

Strings for an interests/goals questionnaire exist (`Só quero acompanhar`, `Já invisto na BODIVA`, `Receber alertas`, `Aprender` …) but the doc states there is no questionnaire and no screen presenting them was found: **not part of the shipped flow** (`UNVERIFIED` leftover).

### 2.17 Profile and Settings

Files: `Features/Profile/ProfileView.swift`, `Features/Settings/{SettingsView,NotificationCategoryControls,MarketRecapPreferenceControl}.swift`.

One sheet titled `Perfil`, opened from the Home initials button; close button top-leading. There is no separate Settings tab.

**Identity card.** 64 pt circle with initials on soft-accent, display name (selectable), email (selectable).

**Settings groups in order** (each group is a titled card of rows; rows have icon, label, optional value, chevron):

| # | Group PT (EN) | Rows |
|---|---|---|
| 1 | `Conta` (Account) | `Gerir conta` → Account management; `Terminar sessão` (Sign out) |
| 2 | `Subscrição` (Subscription) — only when subscriptions are enabled | Row → Plans screen (section 6) |
| 3 | `Notificações` | One row showing `No iOS: {Ativas / Desativadas / Por ativar / Entrega discreta / A verificar}` → Notification settings |
| 4 | `Aparência` (Appearance) | `Tema` (Theme) with current value → theme picker; `Idioma` (Language) with `Português` / `English` → opens the OS per-app language setting |
| 5 | `Ecrã bloqueado` (Lock Screen) | Toggle `Sessão da BODIVA` (BODIVA session Live Activity), default off |
| 6 | `Privacidade nos widgets` (Widget privacy) | Toggle `Mostrar valores da carteira nos widgets`, default off; footer `Por predefinição, os valores ficam ocultos. Ao ativar, autorizas a sua apresentação nos widgets deste dispositivo. O Modo de privacidade continua a ocultá-los.` |
| 7 | `Personalização` | Description `A carteira, a lista e os alertas ajudam a ordenar informação relevante. Os interesses de navegação perdem peso com o tempo.`; button `Reiniciar interesses neste dispositivo` (confirmation text `Interesses reiniciados. Novas ações contam a partir de amanhã. A carteira, a lista e os alertas mantêm-se.`); button `Repor preferências de utilidade` (`Preferências de utilidade repostas.`; footer: preferences stay on device and expire after 56 days; high-relevance events remain eligible) |
| 8 | `Aplicação` (App) | `Sobre a invest.ao` → text page; `Termos` → text page (disclaimer: information for personal tracking, decisions are the user's); `Política de privacidade` → external `https://invest.ao/policy`; `Fontes de dados` → text page (main source BODIVA, plus issuers, official announcements and identified public sources) |
| 9 | `Dados de mercado` (Market data) | `Fonte principal` = `BODIVA`; `Estado do mercado` = status label; `Última atualização` = timestamp or `A aguardar dados` / `Data indisponível`; disclaimer `As cotações podem estar atrasadas, ser corrigidas ou ficar indisponíveis. A informação não constitui uma recomendação de investimento.` |
| — | Footer | `Versão {x.y.z}` |

Debug builds add an internal intelligence debugger entry at the top; it is not a product feature.

**Privacy mode has no Settings row.** It is toggled only by the eye button in the toolbar of Portfolio, position detail, portfolio insight detail and Week ahead. `docs/privacy-mode.md` says "Settings and the portfolio eye button"; the code has no Settings control (doc is stale).

**Theme picker (`Tema da aplicação`).** `Sistema` (default) · `Claro` · `Escuro`; note `A opção Sistema acompanha a aparência definida no iPhone.` Stored on device.

**Notification settings (`Notificações`).**

1. `Permissão no dispositivo`: status + explanation + one button whose label depends on the OS state — `Ativar notificações` (not determined; triggers the OS prompt), `Abrir definições de notificações` (denied), `Gerir no iOS` (granted). Explanations: `Ativa as notificações para receber alertas de preços e movimentos dos títulos que acompanhas.` / `O iOS bloqueou as notificações…` / `O iOS permite notificações…` / `O iOS entrega notificações discretamente…`
2. `Movimentos da tua lista` (Your watchlist movements): row `Sensibilidade` → picker `Baixa` · `Normal` · `Alta` with description `Escolhe a sensibilidade dos avisos automáticos para os títulos que acompanhas.`; note `Recebe avisos automáticos sobre movimentos relevantes dos títulos na tua lista. Podes desligar os avisos de cada título em Alertas.`
3. `Notificações opcionais`: toggles `Fecho diário da BODIVA`, `Movimentos das tuas posições`, `Novas admissões confirmadas`, `Variação diária da carteira`, `Mostrar factos públicos nas notificações`. Footer `Até cinco avisos opcionais por dia. Entre as 20h e as 8h, o radar fica em silêncio. Os valores da carteira e a tua relação com um título ficam dentro da aplicação.`
4. `Atividade invulgar`: toggle `Títulos que sigo` + the seven rule toggles (2.5).
5. `Artigos e resumos do fecho`: toggle `Receber o fecho das acções` with description `Um resumo editorial após o fecho da sessão, com os valores verificados e ligação ao artigo…` and note that delivery depends on OS permission.

Save failures: `Não foi possível guardar as preferências. Tenta novamente.` Preferences are per account (server), except permission which is per device.

**Account management (`Gerir conta`).**

- `Acesso`: `Métodos de acesso` = `Google ou Apple`; `Conta` = email.
- `Eliminar conta`: warning label `Esta ação é irreversível`; text listing what is removed (profile, recorded portfolio, watchlist, alerts, notification history); `A tua conta Google ou Apple mantém-se. Os registos da carteira são manuais: eliminar a conta não vende instrumentos nem encerra contas bancárias ou de corretagem.`; for subscribers `Eliminar a conta não cancela uma subscrição Plus na App Store.` + link `Gerir subscrição na App Store`; `Não será possível recuperar estes dados depois da eliminação.`; destructive button `Eliminar conta`.
- Confirmation dialog `Eliminar conta na invest.ao?` with message naming the account, buttons `Eliminar definitivamente` / `Cancelar`. Progress `A eliminar conta…`. Apple accounts re-authorise with Apple before deletion. Errors: `Não foi possível eliminar a conta` and specific retry/sign-in-again messages.
- On success the app returns to authentication and shows `Conta eliminada`.

Android/web note: in-app account deletion is also a Play policy requirement, and Play additionally requires a web URL where deletion can be requested.

### 2.18 App availability (forced update, maintenance)

Files: `Features/AppAvailability/**`, `Core/FeatureFlags/**`, `docs/POSTHOG_FEATURE_FLAGS.md`.

Two remote gates replace the entire app, including login, onboarding and open sheets. Forced update wins when both are active. Both are evaluated at launch and on return to foreground; each screen has a manual re-check.

| Gate | Remote control | Title | Message | Actions |
|---|---|---|---|---|
| Forced update | Boolean flag `ios-force-update` with payload `{"minimum_version":"x.y.z"}`; blocks builds below it | `Atualiza para continuar` | `Esta versão já não é suportada. Atualiza a aplicação para continuares a acompanhar o mercado.` | `Atualizar na App Store` (opens the store page); `Verificar novamente`; failures `Não foi possível verificar a atualização.` / `Não foi possível abrir a App Store.` |
| Maintenance | Boolean flag `ios-maintenance` | `App em manutenção` | `Estamos a realizar trabalhos no serviço. Volta a tentar mais tarde.` | `Verificar novamente`; `A manutenção continua em curso.` / `Não foi possível verificar o estado do serviço.` |

Layout: centred icon/title/message on an adaptive gradient background; supports PT/EN and Dynamic Type. Android needs its own flags (`android-force-update`, `android-maintenance`) and a Play Store link (or Play In-App Updates); web needs only the maintenance gate.

Separately, the market data service can signal maintenance to the client, which slows polling to every 5 minutes without blocking the UI.

## 3. Design system

Files: `Invest.AO/Core/DesignSystem/**`, `Core/Components/**`, `Core/Charts/**`, `Resources/Assets.xcassets`, `docs/{DESIGN_SYSTEM,LAYOUT_REDESIGN,ui-components,ICON_PACK,UI_REFINEMENTS}.md`. Token values below are from code (`SemanticColors.swift`, `DesignTokens.swift`); where the docs list different hexes, code wins (section 11).

### 3.1 Direction

- Price-first hierarchy on an open canvas; soft tinted action surfaces; one blue interaction accent. References were Coinbase Wallet (price hero, uninterrupted chart) and Phantom (rounded action tiles), translated to a market-following and manual-portfolio product: actions are explore, follow, alert, compare and record — never custody or trading.
- Feel: modern, premium, trustworthy, data-focused, approachable, relevant to Angola. Not: a traditional banking app, a Bloomberg terminal, a generic crypto app, corporate, cluttered, template-driven, noisy.
- Financial information is the visual hero: strong typography, large values, clear hierarchy, generous whitespace, charts integrated into the layout, subtle surfaces, restrained colour, deliberate motion.

### 3.2 Colour tokens (all custom, defined in code as light/dark pairs)

| Token | Light | Dark | Increased-contrast light | Use |
|---|---|---|---|---|
| `appBackground` | `#F2F3F5` | `#090B0F` | — | Page canvas |
| `elevatedBackground` | `#FFFFFF` | `#12151B` | — | Elevated surface: search button, link rows, context card, status pill |
| `cardBackground` | `#FFFFFF` | `#171B22` | — | Grouped card surface |
| `actionSurface` | `#E5E9EF` | `#171E2B` | — | Action tiles, secondary buttons, category cards, empty-state call-outs |
| `accentSoft` | `#E2EAFA` | `#192D4B` | — | Selected tile/range, icon tiles, avatar background |
| `selectedTabBackground` | `#E2EAFA` | `#303238` | — | Selected row in split list |
| `widgetBackground` | `#F2F3F5` | `#090B0F` | — | Widget container |
| `primaryText` | `#182231` | `#F5F7FA` | — | Primary text and values |
| `secondaryText` | `#485364` | `#A6AFBD` | `#283445` | Supporting text |
| `tertiaryText` | `#596579` | `#747E8E` | `#3B4759` | Micro-captions |
| `accent` (= `brandBlue`) | `#1854C5` | `#5A9BFF` | — | Interactive elements, links, primary button fill, index sparkline |
| `onAccent` | `#FFFFFF` | `#090B0F` | — | Text on accent fill |
| `positive` | `#08704C` | `#35C98B` | — | Gains |
| `negative` | `#B9233D` | `#FF6677` | — | Losses, closed-market dot, destructive |
| `warning` | `#845000` | `#F5B544` | — | Opening-soon dot, cautions |
| `separator` | `#C5CDD8` | `#2A303A` | `#778396` | Hairlines |
| `chartGrid` | `#CBD2DC` | `#252B34` | `#778396` | Chart grid lines |
| `cardOutline` | `#C9D0DB` | `#2A303A` | `#778396` | Card edge (only drawn under Increase Contrast), phone-mock outline |
| `controlOutline` | `#778396` | `#2A303A` | — | 1 px outline on secondary buttons and tiles, **light mode only** |
| `comparisonOrange` | `#A34E00` | `#FF9400` | — | 2nd comparison series |
| `comparisonPurple` | `#7935B5` | `#AD52E0` | — | 3rd comparison series |
| Launch background | `#02050A` | `#02050A` | — | Splash (same in both modes) |

Semantic rules

- Gain/loss colour applies to **changes only** (badges, deltas, direction arrows, chart stroke by direction). Prices themselves are neutral primary text.
- Neutral/unknown change uses `secondaryText`.
- Positive/negative never double as the interaction accent.
- Change badge: capsule, min height 28, horizontal padding 8, background = change colour at 12% opacity, text caption semibold in the change colour, with a directional arrow icon and a signed value. VoiceOver: `Subiu {x}` / `Desceu {x}`.
- Unknown quotes render as unavailable text, never as zero.

Paywall palette (hard-coded, always dark, not tokens; `SubscriptionManagementView.swift`, `SubscriptionPaywallStyle.swift`): background gradient `#0B132B` → `#060913` with a top-trailing radial highlight; highlight/tint `#91BAFF`; purchase button `#3361E0`; footer bar `#090D1B`; secondary text white at 68%.

Weekly Wrap player and Live Activity are also always dark (see 2.10 and 7).

### 3.3 Typography

System font throughout (SF Pro on iOS; default design, no rounded or serif, no custom font files). Every role is a Dynamic Type text style, so sizes scale with the user's setting. iOS default sizes at the standard setting are given so another platform can map them (Roboto/Inter with the same roles).

| Token | iOS style | Default size | Weight | Use |
|---|---|---|---|---|
| `InvestFinancialHeadline` | fixed 44 pt scaled relative to largeTitle, tracking −1.5 | 44 | Semibold | Hero price, index value, portfolio value, alert threshold |
| `displayFinancial` / `screenTitle` | largeTitle | 34 | Bold | Display values, page titles |
| Overview index value | largeTitle | 34 | Semibold | Home overview card |
| `assetPrice` | title2 | 22 | Semibold | Secondary financial values, session stats |
| `sectionTitle` | title3 | 20 | Semibold | Section headers, card headlines |
| `body` | body | 17 | Regular (Semibold for symbols, prices in rows, buttons) | Rows, body copy |
| `numeric` | body | 17 | Medium | Metric values |
| `secondary` | subheadline | 15 | Regular (Medium/Semibold for emphasis) | Supporting text, card titles |
| `caption` | caption | 12 | Regular (Semibold in badges and range chips) | Labels, footnotes |
| micro | caption2 | 11 | Medium/Bold, tracking 0.4–1.5, uppercase | Eyebrows, metric sub-captions |

Numeric rules: every number uses tabular (monospaced) digits; changing values animate with a numeric roll (0.25 s ease-out); long values may shrink to 68–72% before truncating; never wrap a value across lines.

Casing: sentence case for titles and labels; uppercase only for eyebrows and micro-captions.

### 3.4 Spacing, radius, size, elevation

| Scale | Values |
|---|---|
| Spacing (pt) | 4, 8, 12, 16, 20, 24, 32, 40 (`space4`…`space40`) |
| Corner radius | small 12, medium 18, large 24, pill (capsule) |
| Page margin | 20 horizontal |
| Section gap | 20 on phones, 32 on wide layouts; 32 between Explore blocks |
| Card padding | 20 default; 16 compact; 24 for the context card |
| Min touch target | 44 × 44 |
| Primary/secondary button | full width, min height 56, capsule, padding 20 × 16, body semibold |
| Asset row | min height 80, vertical padding 12, logo 48 (36 in rail tiles), gap 12 |
| Icon tile | 48 × 48 (42 in context card), radius 18, soft-accent fill |
| Hairline | 1 pt `separator`; chart grid 0.5 pt dashed 3/4 |
| Elevation | Mostly flat. Only two soft shadows exist: metrics strip (black 5.5%, radius 16, y 8) and the market-updates card (black 4.5%, radius 14, y 7). No elevation tiers |
| Pressed state | Opacity 0.76 and scale 0.98 (0.16 s); disabled opacity 0.42 |

### 3.5 Layout principles

- **Do not turn every section into a rounded card.** Keep price heroes and asset rows on the canvas. Use surfaces for actions, grouped form input and supporting information.
- Cut taglines, helper text and secondary labels; if a screen needs them to make sense, fix the layout (repo `AGENTS.md`, rule 1).
- One contextual promotion at a time on Home; never stack promotional cards.
- Lists are plain rows separated by hairlines inset to the text edge (76–80 pt leading inset after a logo).
- Section header = title3 semibold title, optional trailing text action; has the header accessibility trait; wraps to two lines when it does not fit.
- Navigation: native bottom tab bar with five destinations; inline (small) navigation titles; pushed details hide the tab bar; sheets carry an explicit close button top-leading; primary actions sit in a persistent bottom area on detail and editor screens.
- Glass/translucency is restricted to navigation and controls (tab bar, toolbars, compact circular buttons, the persistent detail action bar). Charts, values, rows and form surfaces stay opaque. With Reduce Transparency, custom controls fall back to solid surfaces.
- Scroll views use a soft edge fade under bars and hide scroll indicators.
- Large text: horizontal groups (header + status, value + sparkline, row left/right) restack vertically at accessibility sizes; range pickers scroll instead of shrinking.
- Missing data uses a compact explanation, not a large empty panel.

### 3.6 Motion and haptics

| Pattern | Spec | Reduce Motion |
|---|---|---|
| Content presence (sections appearing/changing) | Fade + 8 pt upward offset, 0.24 s ease-out | Fade only, 0.15 s |
| Numeric value change | Digit roll, 0.25 s ease-out | No animation |
| Root/state cross-fade | 0.24–0.35 s ease-in-out | 0.12 s or none |
| Button press | Scale 0.98 + opacity, 0.16 s | Opacity only |
| Star / watchlist toggle | Snappy 0.24 s | None |
| Error toast | Slides from top with spring (response 0.42, damping 0.86); dismiss spring 0.32 / 0.9 | 0.2 s fade |
| Skeleton pulse | Opacity 0.9 ↔ 0.5, 0.9 s ease-in-out, repeating | Static |
| Shimmer (chart loading) | Linear highlight sweep 1.6 s, repeating, primary text at 16% | Static |
| Bell badge swap | Symbol replace, 0.24 s | None |
| Onboarding | 0.7 s spring phone move, 0.45 s caption blur-dissolve | Fades |
| New-listing reveal | Logo enters, rings expand, one accent burst on confirmed day; settles, no looping | Opacity reveal, no scroll animation |

No continuous or decorative looping animation outside loading states and the Weekly Wrap player.

Haptics (`sensoryFeedback` usages)

| Feedback | Events |
|---|---|
| Selection tick | Time-range change; chart scrub (asset, comparison, simulator); sort-direction toggle; market-information category change; watchlist add/remove (search star, asset screen, add sheet, watchlist list); simulator preset; privacy-mode toggle |
| Success | Alert saved (also plays `alert-success.wav` and posts a VoiceOver announcement); watchlist-alert saved |
| Light impact | Onboarding page change; first reveal of a new-listing highlight |
| Wrap-specific | Page-turn and reveal haptics in the Weekly Wrap player (2.10) |

### 3.7 Iconography

- A custom **rounded outline icon pack of 56 symbols**, 24 × 24 grid, 2-unit round strokes, single weight, tinted by the inherited foreground colour (`Resources/Assets.xcassets/Icons/invest.*.symbolset`, masters in `Tools/IconPack/masters.json`). Three scales S/M/L follow the font size.
- Names: home, markets, portfolio, watchlist, search, news, chart, wallet, trend-up, trend-down, exchange, calculator, bond, dividend, calendar, history, alert, notification, profile, settings, shield-check, lock, eye, eye-off, add, remove, close, check, check-circle, info, warning, help, arrow-up-right, arrow-down-right, arrow-up, arrow-down, arrow-left, arrow-right, chevron-left, chevron-right, chevron-up, chevron-down, expand, collapse, refresh, share, download, upload, edit, trash, filter, sort, more, document, copy, offline.
- A bridge maps system symbol names to the pack (`house`→home, `star`→watchlist, `bell`→alert, `bell.badge`→notification, `magnifyingglass`→search, `briefcase`/`chart.pie`→portfolio, `square.grid.2x2`/`building.columns`→markets, `newspaper`→news, `eye.slash`→eye-off, `square.and.arrow.up`→share, `wifi.slash`→offline, etc.). Anything not in the pack falls back to the platform symbol (e.g. `waveform.path.ecg` for unusual activity, `book.closed` for Learn, `checkmark.seal.fill` on the paywall). Server-provided icon names for news go through the same bridge.
- Outline only: selected state is expressed by tint and accessibility value, not by a filled variant.
- Decorative icons are hidden from screen readers; icon-only buttons always have a label.
- Brand marks: app icon mark (dark and light SVG variants), a white **palanca** (giant sable antelope) mark, Google sign-in mark. App icon master in `Design/AppIcon/invest-ao-master.svg`.
- Issuer logos: circular, loaded remotely and cached; fallback is a coloured monogram using a per-issuer brand colour key (blue, gold, green, …).

For Android/web: ship the same 56 SVG masters as vector drawables / an SVG sprite; do not substitute Material icons for the pack, only for the fallbacks.

### 3.8 Chart rules

| Aspect | Rule |
|---|---|
| Type | Line with a soft area fill. No candlesticks, no bars for price |
| Line | 2.5 pt default (range-dependent width; 2 pt for sparklines), round caps and joins, **linear** interpolation (no smoothing) |
| Area | Same hue at 10% opacity |
| Colour | By direction over the visible range: positive green, negative red, secondary grey when unknown. Index sparkline on Home uses accent blue |
| Height | 184 pt default; 160 in the market sheet; sparkline 100 × 64 |
| Y axis | Trailing side, ~4 automatic ticks, dashed 0.5 pt grid, compact labels with `k` / `M` / `B` suffixes and 0–2 decimals; can be hidden |
| X axis | A few date labels chosen per range; no vertical grid |
| Endpoints | First/last point markers with their values pinned on the Y axis (`ChartEndpoints`) |
| Scrub | Drag to select the nearest real observation; header price and change update to "vs range start"; selection haptic per step; never interpolates between observations |
| Ranges | `1D` · `1S` · `1M` · `3M` · `6M` · `1A` · `Tudo`; chips are 44 pt min, caption semibold, selected chip has a soft-accent rounded fill; spoken names are expanded (`Um mês`); disabled ranges stay visible but inert |
| Loading | Shimmer placeholder of the same height, then a reveal; never fake data |
| Empty/failed | In-place text + retry; chart toasts for refresh failure |
| Comparison | Percent change from a common start; series colours: accent blue, `comparisonOrange`, `comparisonPurple` |
| Private portfolio trend | Unitless normalised line, no Y axis, no scrubber, text-only accessibility description |
| Widget sparkline | Observed closes in session order, subtle area, no dashed midline, max 30 points |
| Accessibility | Chart exposes `Evolução do preço` with a start/end summary (`Começou em … e terminou em …`) |

### 3.9 Component catalog

| Component | What it is | Used in |
|---|---|---|
| `InvestButtonStyle` (primary / secondary) | Full-width capsule button, 56 pt; primary accent fill, secondary action-surface fill with outline in light mode | Onboarding, editors, Home "Explorar o mercado" |
| `ActionButton` | Button with loading state that keeps its title, exposes progress to VoiceOver and blocks repeat taps | Forms, retry banners |
| `InvestIconButtonStyle`, `SheetCloseButton`, `DestructiveGlassButtonStyle` | Circular icon buttons, sheet close, destructive variant | Toolbars, sheets |
| `InvestActionTile` | Icon above label tile, min 80 pt, selected = soft-accent + accent outline | Asset detail actions, gallery |
| `InvestAssetRow` | Logo + symbol + name, price + change badge or `Preço por confirmar`; stacks at large text | Home, Explore, Search, Watchlist, Unusual activity |
| `InvestFeatureRow` | Icon tile + title + subtitle | Onboarding, Home empty watchlist |
| `InvestCard` / `.investCard()` | Surface (card or elevated), padding 20, radius 24; outline only under Increase Contrast | Overview, settings groups, link rows |
| `SectionHeader` | Title + optional action | Everywhere |
| `InvestPageHeading` | Large page title + subtitle | Search |
| `InvestSectionTabs`, `InvestSegmentedControl` | Text tabs / segmented control | Home movers, asset detail tabs, portfolio |
| `TimeRangePicker` | Range chips (see 3.8) | All charts |
| `SearchField` | Rounded inset field with clear button | Explore, Search, pickers, onboarding |
| `FinancialValueText` | Styled, formatted financial value | Shared |
| `PercentageChangeBadge` | Signed change capsule with arrow | Shared |
| `MarketMetric` | Label + value + caption cell | Market metrics |
| `MarketStatusIndicator` | Dot + status label | Home, asset detail |
| `SecurityLogoView`, `SecurityIdentityHeader`, `SecuritySparkline`, `MarketRow` | Issuer identity pieces | Lists and detail |
| `PriceChart`, `ChartEndpoints`, `ChartShimmerView`, `ChartRevealContainer` | Chart stack (3.8) | Asset detail, market sheet |
| `LoadableContent` | Loading → content → error switcher with retry | Explore, Search |
| `LoadingStateView`, `EmptyStateView` (+ `StateRecoveryAction`), `ErrorStateView` | Full-area states: spinner + message; icon + title + message + optional recovery button; error + optional retry | Everywhere |
| `SkeletonPlaceholder`, `InstrumentRowSkeleton`, `SkeletonPulse`, `LoadingShimmer` | Skeleton blocks and animation | Home, lists |
| `MarketSectionPlaceholder` | Inline section failure with retry | Home sections |
| `ErrorToast` / `GlobalErrorPresenter` / `MarketRefreshErrorModifier` | Top toast with retry and dismiss | App-wide |
| `OfflineBanner` | `Sem ligação à Internet` + `Os dados podem estar desatualizados.` | App-wide |
| `SensitiveValue` (`.sensitiveValue()`) | Replaces content with six dots, keeps layout, VoiceOver `Valor oculto` | Portfolio, alerts, activity |
| `PrivacyModeButton` | Eye / eye-off toolbar toggle with first-use explanation alert | Portfolio, position, insights, week ahead |
| `ScenePrivacyCover` | Opaque cover when the app is not active | App switcher |
| `AngolanAmountField` | Numeric input with decimal comma and live thousands grouping | Editors, simulator, alerts |
| `SyntheticIndexInfoSheet` | Indicator methodology sheet | Home, Explore |
| `SafariView` | In-app browser | Sources, issuer links |
| `CSVFile` | Shareable CSV document | Exports |
| `DesignSystemGallery` | Debug-only component gallery (`--design-preview`) | Not shipped |

### 3.10 Accessibility commitments

- **Dynamic Type** everywhere; layouts restack at accessibility sizes; the decorative onboarding phone shrinks; Wrap stories get +4 s; fixed-size text is limited to the 44 pt hero (which still scales).
- **VoiceOver**: rows are combined into one element with a hint (`Abre os detalhes do título`); changes are spoken as "rose/fell"; prices have explicit labels and values; headers carry the header trait; selection has the selected trait; hidden values read `Valor oculto`; charts have text summaries; the app name is spoken `invest ponto ao`; announcements on privacy toggle and alert save.
- **Contrast**: dedicated increased-contrast values for secondary/tertiary text, separators, grid and card outlines; cards gain an outline under Increase Contrast; light-mode controls carry a visible outline.
- **Reduce Motion**: every animation has a fade or no-animation fallback (3.6). **Reduce Transparency**: solid fallbacks for glass controls.
- **Colour independence**: direction is always also conveyed by sign and arrow.
- 44 pt minimum targets. Keyboard dismisses on scroll in search contexts.
- Stated gaps in the docs: no complete VoiceOver/Switch Control/device audit has been done.

### 3.11 Appearance

- Light and dark are both first-class; setting `Tema` = System (default) / Light / Dark, per device.
- Always-dark surfaces: paywall, Weekly Wrap player, Live Activity, splash.
- Widgets follow the system appearance with the same tokens.

### 3.12 Translation notes for Android and web

| iOS primitive | Neutral spec to implement |
|---|---|
| Liquid Glass tab bar/toolbars | Standard bottom navigation / top app bar with a translucent or solid surface; keep content opaque. Do not imitate glass on Android |
| Text styles | Map the role table in 3.3 to a type scale (sp / rem) and honour the OS font-scale setting |
| Custom symbol sets | Same SVG masters as vector assets |
| `numericText` transition | Per-digit roll or simple cross-fade, 250 ms |
| Sheets with detents | Modal bottom sheets (Android), dialogs/side panels (web desktop) |
| `sensoryFeedback` | Android haptic constants for selection/confirm; none on web |
| Pull to refresh | Pull-to-refresh on Android; explicit refresh control + auto-refresh on web |
| Split view on regular width | Two-pane list/detail on tablets, foldables and desktop web |

## 4. Product voice, copy, localization and formatting

### 4.1 Voice (`docs/product-copy.md`, `Core/ProductVoice/**`)

- Angolan Portuguese, natural local terminology. Clear, calm, direct. Addresses the user as **tu**. Capital letter only at the start of titles and labels (plus proper names and acronyms).
- Credible and concise, occasionally playful — playfulness is confined to notification titles and a few highlights (`BAI hoje não veio brincar 📈`, `Hoje a BODIVA decidiu descansar ☕️`, `Newcomer in the building! 👋`). Declines never use celebration. Errors, methodology, formulas, privacy, destructive confirmations and critical navigation always use plain language.
- The shared voice catalogue presents verified facts only; it never changes thresholds or invents causes. Personal relationships ("your portfolio", "your watchlist") appear only on authenticated surfaces, never on the lock screen.
- Never promise real-time data, personalisation, bank sync or privacy the product does not implement. Distinguish historical price from forecast, and percentage performance from price.
- Errors say what failed and one possible recovery, never technical text. Actions are concrete: `Registar compra`, `Guardar compra`, `Tentar novamente`.

Vocabulary

| Concept | Preferred PT | Note |
|---|---|---|
| Portfolio | `Carteira` | Manually recorded positions |
| Holding | `Posição` | |
| Purchase entry | `Registar compra` | A record; it does not execute an order |
| Watchlist | `Lista de acompanhamento` | `Lista` / `Acompanhar` / `A acompanhar` in compact navigation |
| Security | `Instrumento` | `Título` also fine in financial context |
| Equity | `Ação` | In-app copy uses the post-1990 spelling `ação`; **store listing and brand kit use `acção`**; search accepts both |
| Quote | `Cotação` | Price plus its date |
| Performance | `Desempenho` | State the comparison base |
| Invested value / Current value | `Valor investido` / `Valor atual` | |
| Incomplete valuation | `Valor parcial` | Quotes missing for one or more positions |
| Average purchase price | `Preço médio de compra` | |
| Unrealised result | `Ganho/perda` | |
| Proprietary metric | `Indicador invest.ao` | Never presented as an official BODIVA index |
| Ticker | `Símbolo` | |
| Product name | `invest.ao` (lowercase); spoken `invest ponto ao` | Store name `invest.ao: Bolsa de Angola` |
| Currency | `Kz` in running copy; ISO `AOA` in formatters | |

Standing disclaimers (reuse verbatim on every platform)

- `Informação de mercado. Não constitui recomendação de investimento.`
- `As cotações podem estar atrasadas, ser corrigidas ou ficar indisponíveis. A informação não constitui uma recomendação de investimento.`
- `Indicador invest.ao; não é um índice oficial da BODIVA.`
- `As simulações são ilustrativas. A invest.ao não executa ordens nem guarda os teus investimentos.`
- Sign-in: `Não liga a tua conta bancária ou de corretagem.`

### 4.2 Localization

| Fact | Value |
|---|---|
| Catalogue | `Invest.AO/Resources/Localizable.xcstrings` (single string catalogue, shared by app and widgets) |
| Source language | `pt` |
| Locales | `pt` (1 971 localized entries) and `en` (1 961) |
| Keys | 1 989 total |
| Naming convention | ~1 540 dotted semantic keys `feature.area.name` (e.g. `home.overview.header`, `subscriptions.paywall.watchlistReason`), with format arguments kept in the key (`home.hero.gains %lld`). The remaining ~450 are legacy keys where the Portuguese sentence itself is the key |
| Largest namespaces | common 172, portfolio 128, weeklyWrap 114, assetDetails 97, subscriptions 96, settings 75, home 66, onboarding 61, watchlist 55, learn 52, formatting 48, simulation 48, news 47, market 41, notification 38, errors 37, widgets 37 |
| Language selection | Follows the device language; English when the device prefers English, Portuguese otherwise. Profile → Aparência → Idioma opens the OS per-app language setting; changing it relaunches the app |
| Push language | The chosen language is registered with the device so remote notifications are localized server-side |
| Not translated | Authored news, issuer names and source documents keep their published language |
| Locale for formatting | `pt_AO` or `en_AO` (region always Angola) |

`docs/product-copy.md` still says the app has "no translation catalogue"; that is outdated.

For Android/web: reuse the dotted keys as resource ids / message ids, keep `pt` as the default resource set and `en` as the alternative, and migrate the ~450 sentence-keys to dotted names during the port.

### 4.3 Number, currency, percent and date formatting (`Core/Formatting/**`)

| Kind | Rule | Example (pt_AO) |
|---|---|---|
| Decimal separator / grouping | Comma decimal, space-type thousands grouping per `pt_AO`; `en_AO` uses the English conventions for the same region | `1 250 000,50` |
| Plain number | Fixed 2 fraction digits by default; optional forced sign | `14 862,34`, `+12,40` |
| Currency | ISO-code driven (`AOA` default), locale-formatted; **0 fraction digits by default** for amounts, **2 for instrument prices**; optional forced sign | `1 250 000 Kz`, `65 000,00 Kz` |
| Percent | Number + `%` with no space; 2 digits by default; **sign always shown for changes** | `+1,20%`, `−0,45%` |
| Tiny percentages | Never round a non-zero value to zero: `Entre 0% e +0,1%`, `Entre −0,1% e 0%`, `<0,1%`, `>99,9%` | |
| Percentage points | Bond price changes and yield differences: signed number + ` p.p.`; tiny values `Entre 0 e +0,01 p.p.` | `+0,25 p.p.` |
| Bond price | Percent of par with at least 2 decimals | `98,50%` |
| Quantity | 0–4 fraction digits | `120`, `0,3333` |
| Chart axis | Compact with `k`, `M`, `B` suffix, 0–2 decimals | `65k`, `1,25M` |
| Integer counts (volume, trades) | Grouped, 0 decimals | `12 340` |
| Missing value | `—` in metric cells; explicit text elsewhere (`Preço por confirmar`, `Valor indisponível`, `Variação indisponível`, `Sem cotação`) | |
| Amount input | Decimal comma; typing `.` inserts `,`; live thousands grouping while typing; 2–8 fraction digits; caret preserved; invalid characters rejected; range message `Introduza um valor entre 0 e 1 000 000 000 000 Kz.` | |
| Date | Locale-abbreviated date in the market calendar; maturity uses day + full month + year; transactions use day + abbreviated month + year | indicative: `10 de nov. de 2026` |
| Timestamp | Abbreviated date + short time + ` · Luanda` suffix | indicative: `10 de nov. de 2026, 15:30 · Luanda` |
| Period | `{date} – {date}` (en dash) | |
| Relative day | `Hoje · {hora}`, `Ontem · {hora}`, `desde ontem` | |
| Time zone | Always Africa/Luanda, regardless of device zone | |
| Latest selectable date in pickers | End of today in Luanda | |

English keeps the decimal comma for **financial inputs** (README: "Financial inputs keep the existing comma-based decimal editing").

## 5. Cross-cutting UX

### 5.1 Privacy mode (`docs/privacy-mode.md`, `Core/Privacy/**`, `Core/Components/{SensitiveValue,PrivacyModeButton,ScenePrivacyCover}.swift`)

- Device-level preference, **off by default**, survives sign-out and account change, shared with widgets.
- Toggle: eye / eye-off toolbar button (`Ocultar valores` / `Mostrar valores`) on Portfolio, position detail, portfolio insight detail and Week ahead. First use shows an explanation alert titled `Valores ocultos`: "Oculta valores da carteira e dos alertas nesta aplicação. Os instrumentos, a tendência do gráfico, as cotações públicas e os campos de edição continuam visíveis. Não altera as notificações do sistema." with `Entendido`. Selection haptic; VoiceOver announces `Modo de privacidade ativado/desativado`.
- Rendering: hidden values keep their layout footprint and show six dots; not selectable; VoiceOver `Valor oculto`. Hiding is immediate; revealing may animate briefly.

| Surface | Hidden | Kept |
|---|---|---|
| Portfolio summary, metrics | Balance, invested, gain/loss, personal return | Titles, quote-availability status |
| Holdings, position detail | Quantity, average cost, value, gain/loss, return | Instrument identity, public quote |
| Records | Quantity and price | Date, edit/delete |
| Allocation | Entire breakdown incl. bars and ranking | Title and footprint |
| Portfolio history chart | Values, numeric axis, accessible data | Unitless trend and date axis |
| Alert rules (read-only rows) | Thresholds | Rule type, controls |
| Activity center | Titles/messages that could contain a target or personal content → `Conteúdo pessoal oculto no Modo de privacidade.` | Type, time, read state |
| Home | Personal percentages and watched symbols in the context slot | Public market content |
| Week ahead | Relationship badges and personal counts | Public events |
| Watchlist | Weekly reading card | Prices |
| Weekly Wrap | Personal/financial stories | Public stories |
| Portfolio widget | Values, returns, holdings | Title, availability |

- Holdings sort by instrument id while hidden so order does not leak position size.
- Public prices, movements, news and price charts are never hidden. Editable fields stay usable.
- **App-switcher cover**: independently of privacy mode, an opaque canvas-coloured cover (`invest.ao. Conteúdo protegido.` for accessibility) is shown whenever the app is not active. Android equivalent: `FLAG_SECURE` or a recents-screenshot cover; web: none.
- Widget values are additionally opt-in (Settings → `Mostrar valores da carteira nos widgets`, default off).
- Lock-screen notification copy is generic by construction (`Nova informação em invest.ao` / `Abra a aplicação para consultar a atualização.`) unless the user enables `Mostrar factos públicos nas notificações`; personal amounts never appear in pushes.

### 5.2 Personalisation (`docs/PERSONALIZATION_DECISIONS.md`, `Core/Personalisation/**`)

- One shared ranking engine orders already-verified facts across Home, Portfolio, Watchlist, Wrap, Discover, Activity and Week ahead. It never changes financial calculations or what counts as significant.
- Inputs: current holdings, watchlist, enabled alerts (explicit relationships) plus bounded daily activity counters (instrument views, search selections, opens) with **28-day decay**; counters sync to the account.
- Local exposure receipts prevent the same fact from being promoted twice; watchlist novelty receipts and "usefulness" feedback last **56 days** on device.
- User controls: `Reiniciar interesses neste dispositivo`, `Repor preferências de utilidade`; per-item "not useful" / "show fewer of this type" on watchlist observations and Wrap feedback.
- Privacy mode zeroes interest-based points. Notifications add a conservative local novelty/interruption policy on top of server gates (max five optional per day, quiet 20:00–08:00).
- No learned model, no collaborative filtering, no A/B-driven ranking.

### 5.3 Onboarding

Introduction (2.14) → authentication (2.15) → account setup (2.16) → Home → one paywall offer for Free accounts. Permission prompts are contextual, never on first launch.

### 5.4 Contextual store-review prompt (`docs/contextual-reviews.md`, `Core/Reviews/**`)

- Qualifying completed tasks: a comparison with ≥2 visible series viewed and dismissed, or shared successfully; creating a custom alert (after the permission flow ends); creating a portfolio record. Edits, pauses, deletes, cancels and failures do not count. Each comparison counts once.
- Threshold: **3 completed tasks across 2 sessions** (a session = cold launch or ≥30 min in background).
- Limits: 90-day cooldown; at most one request per marketing version.
- Timing: the request waits (up to 5 minutes, in memory only) for an active window with no keyboard, modal or transition, then 1.5 s of quiet. Never on app open.
- Android: Play In-App Review API with the same policy. Web: none (optionally a link to the stores).

### 5.5 App availability

Forced update and maintenance screens (2.18).

### 5.6 Errors (`docs/global-error-handling.md`, `Core/Errors/**`)

| Category | Title PT | Message PT | Retry |
|---|---|---|---|
| Offline / connection lost | `Sem ligação à Internet` | `Verifica a ligação à Internet e tenta novamente.` | Yes |
| Timeout | `O serviço demorou a responder` | same | Yes |
| Server / unavailable | context title (e.g. `Não foi possível carregar o mercado`) | `Serviço indisponível. Tenta novamente daqui a pouco.` | Yes |
| Rate limited | `Aguarda um momento` | `Tenta novamente dentro de alguns instantes.` | Yes, after waiting |
| Session expired | `Inicia sessão novamente` | `A tua sessão terminou. Inicia sessão para continuar.` | Central re-auth |
| Permission | `Acesso não permitido` | `A tua conta não tem permissão para esta ação.` | No |
| Malformed data | `Não foi possível apresentar os dados` | `Os dados recebidos não estão disponíveis para consulta. Tenta mais tarde.` | No |
| Missing instrument | `Instrumento indisponível` | `Volta à lista e escolhe outro instrumento.` | No |
| Validation | `Verifica os dados` | `Revê os dados e tenta novamente.` | No |
| Unknown | `Não foi possível continuar` | `Fecha e volta a abrir a aplicação.` | Where offered |

Presentation rules

- Initial-load failure → full-area error state inside the screen, with retry.
- Refresh failure with content on screen → content stays; one compact top toast (`Não foi possível atualizar o mercado`) with retry (`A tentar novamente`) and dismiss (`Fechar aviso`).
- Cross-screen mutations (watchlist, alerts, portfolio saves) → one global toast; errors are de-duplicated per operation and grouped (connectivity together, backend together); group retry runs each failed operation once.
- Blocking problems may use an alert. Authentication failures clear pending toasts and trigger a single sign-in transition.
- Empty results are never errors. No automatic retry loops at app level (only the market refresh cadence).
- Backend messages, SQL, endpoints and ids are never shown.

### 5.7 Refresh and freshness

- Pull to refresh on Home, Explore, Watchlist, Portfolio, News, Activity, Unusual activity.
- Automatic foreground refresh cadences in 1.5.
- Freshness is communicated by **labels on the value**, not by a global "last updated" line: `Último fecho verificado · {data}`, `Cotação · {data}`, `Preço por confirmar`, `Publicado {data, hora}` in Explore session data, `Última atualização` in Settings. Saved/cached intelligence is labelled (`Leitura guardada · dados de {data} · não atualizados em tempo real.`, `Agenda guardada · …`, `Histórico guardado · última atualização em …`).
- Offline banner plus revoked current quotes when the network is unavailable.
- Widgets deliberately show no freshness footer.

### 5.8 Haptics, accessibility, dark mode

See 3.6, 3.10, 3.11.

## 6. Subscription UX

Files: `Features/Subscriptions/**`, `Core/Subscriptions/**`, `docs/subscription-{foundation,rollout-1.1.1,release-checklist}.md`.

### 6.1 Tiers

| Tier | Display name | Store products | Price shown in docs / preview |
|---|---|---|---|
| Free | `Grátis` / `Plano gratuito` | — | — |
| Plus | `invest.ao Plus` | `ao.invest.plus.monthly`, `ao.invest.plus.annual` (entitlement `plus`) | US$7,99/month, US$79,99/year |
| Pro | `invest.ao Pro` | `ao.invest.pro.monthly`, `ao.invest.pro.annual` (entitlement `pro`) | `UNVERIFIED` — no price for Pro in the repo; shown only if the store returns Pro packages |
| Lifetime Plus (gift) | `Plus vitalício` | none — granted server-side by the founder | free |
| Referral credit | Plus until a date | none | free |

- The UI always renders the **localized price returned by the store**, never a hard-coded price (the US$ strings exist only for a debug preview).
- Monthly and annual unlock identical access. Annual shows `Poupa {n}%` when it is ≥1% cheaper than 12 × monthly in the same currency.
- Intro offer: **7-day free trial** for eligible accounts, once per subscription group. Button becomes `Experimentar 7 dias grátis`; footer `7 dias grátis, depois {preço}/{período}. Renovação automática. Cancela antes do fim do teste para evitar a cobrança.`
- Pro includes everything in Plus. Family Sharing row (`Até 6 pessoas`) appears only when the store product is family-shareable.

### 6.2 What each tier unlocks (as displayed on the plans screen and enforced in code)

| Feature | Free | Plus | Pro |
|---|---|---|---|
| Saved watchlist instruments | 3 | up to 500 | = Plus |
| Automatic movement alerts | 1 instrument | all saved | = Plus |
| Comparison | 1 pair of 2 instruments per Luanda week (reopening the same pair and changing range is free; resets Monday 00:00 Luanda) | up to 3 instruments, no weekly limit | = Plus |
| Income (`Rendimentos`) | calendar | totals and reminders | = Plus |
| Benchmark (inflation and rates) | — | yes | = Plus |
| Portfolios | 1 | 10 | = Plus |
| Statement import | CSV | CSV, photo and PDF | = Plus |
| Annual report export | — | yearly PDF per instrument | = Plus |
| Cash (deposits, withdrawals, fees; balance and total result) | — | yes | = Plus |
| Price history | up to `1A` | `Tudo` | = Plus |
| Price history CSV export | — | yes | = Plus |
| Custom alert rules | 2 | unlimited | = Plus |
| Watchlist groups | — | 20 | = Plus |
| Liquidity section | — | frequency, value and exit | = Plus |
| Order book depth | 5 levels | 5 levels | all levels |
| Read-only portfolio share links | — | — | 20 |

Not gated: market data, asset details, news, Learn, Week ahead, Unusual activity, simulator, Weekly Wrap, Activity center, widgets, portfolio ledger basics and CSV import/export.

### 6.3 Paywall / plans screen (`SubscriptionManagementView`)

One screen serves as paywall, plan management and referral hub. Always dark, with its own blue palette (3.2).

Order of content:

1. Hero title `invest.ao Plus` (or `invest.ao Pro`). When opened from a blocked action, the reason sentence is shown, e.g. `O plano gratuito inclui 3 instrumentos guardados.`
2. Comparison table `RECURSO / GRÁTIS / PLUS` with the rows of 6.2.
3. If Pro packages exist: second table `PLUS / PRO` (order book, read-only links).
4. Membership block for subscribers: `O teu Plus está ativo` / `O teu Pro está ativo` / `Plus vitalício`, `Obrigado por acompanhares o mercado connosco.` or `Uma oferta de {nome}. Sem cobrança nem renovação.`, link `Gerir subscrição`.
5. Referral block (6.5).
6. Status messages: info line, `Estamos a confirmar o teu acesso. Atualiza o estado antes de continuar.`, `Inicia sessão para subscrever ou restaurar compras.`
7. Support: `Atualizar estado`, `Gerir subscrição`, trial/renewal terms paragraph, links `Termos` (Apple standard EULA) and `Privacidade` (`https://invest.ao/policy`).
8. Disclosure `Preferes continuar no gratuito?` → summary `3 instrumentos guardados · movimentos automáticos de 1 instrumento · 1 par de 2 instrumentos por semana.`, the weekly-limit note, and link `Escolher instrumentos gratuitos`.
9. Sticky footer (hidden when nothing more can be bought): heading `Escolhe o teu plano`; segmented `Plus | Pro` when both are offered and the user has neither; plan rows `Anual` (preselected, with savings pill) and `Mensal`, each a selectable radio card (radius 20; selected = 2 px highlight border); purchase button `Experimentar 7 dias grátis` / `Continuar com o Plus` / `Continuar com o Pro` with arrow and spinner while working; renewal summary line.

Toolbar: `Restaurar` (Restore) top-trailing. When presented as a paywall, a cancel action `Continuar no gratuito` top-leading; dismissal is blocked while a purchase is in flight.

States: plans failed to load → `Não foi possível carregar os planos.` / `Tenta novamente para consultar os preços da App Store.` + retry. Purchase problems → `Não foi possível concluir a compra. Se estiver pendente de aprovação, o acesso será atualizado após a confirmação.`; restore → `Não foi possível restaurar as compras.` / `Não foi encontrada uma subscrição Plus ativa para esta conta.`; sync → `O estado da subscrição está a ser sincronizado.`

### 6.4 How locks are presented

- The locked control stays visible and tappable (sometimes with a lock icon). Tapping opens the paywall as a full-screen cover on the surface that requested it, with a reason sentence.
- After a verified purchase the **blocked action resumes automatically once**; closing the paywall or switching account discards it.
- Server-detected limits behave the same (4th watchlist instrument, 2nd movement instrument, 3rd compared instrument or a different pair in the same week).
- Missing comparison data never consumes the weekly allowance: `Ainda não existem dados verificados suficientes para esta comparação. A tua comparação gratuita não foi utilizada.`
- Paywall triggers and their sentences: onboarding, watchlist, movement, comparison, income, benchmark, portfolios, statement import, annual report, cash, history, price export, alerts (`Crie mais de 2 alertas com o Plus.`), watchlist groups, liquidity, order-book depth (Pro), read-only links (Pro).
- **Downgrade**: nothing is deleted. A Free user with more than 3 saved instruments chooses 3 active ones and 1 for automatic movements on the `Plano gratuito` screen; the rest are `Pausado`. Plus users can pre-set that choice.
- Signed-out users cannot purchase.

### 6.5 Referral (`Convidar amigos`)

- Reward copy: `Cada amigo que convidares ganha 1 mês de Plus. Tu ganhas 1 mês quando ele subscrever o Plus.`
- Shows the member's code (selectable) and a share button with message `Usa o meu código {código} no invest.ao e ganha 1 mês de Plus. {link da loja}`.
- `Plus oferecido até {data}` when credit exists.
- `Tenho um código` → dialog `Código de convite` with an uppercase field and `Usar`. Errors: code does not exist; own code; already used; `Os códigos são para contas criadas há menos de 30 dias.`; invites unavailable; generic.
- The block is hidden when referrals are closed server-side.

### 6.6 Lifetime gift

A one-time celebratory sheet: eyebrow `UMA OFERTA PARA TI`, title `O Plus é teu.\nPara sempre.`, `{nome} ofereceu-te acesso vitalício ao Invest.AO Plus.`, three benefits (more instruments, automatic movements for saved instruments, comparisons without weekly limit), `Sem pagamentos. Sem renovação. É a nossa forma de te agradecer por fazeres parte desta jornada.`, a note that an existing store subscription is not cancelled automatically (+ `Gerir uma subscrição existente`), and button `Começar a explorar`.

### 6.7 Platform notes

- Billing on iOS is via the App Store through a purchase SDK; entitlement truth is the backend. Android needs Play Billing products mirroring the four product ids and the same entitlements; one account must hold the same tier on every platform.
- The web app must not sell these digital subscriptions inside the iOS/Android apps' webviews, but a standalone web checkout is a business decision outside iOS parity. At minimum the web shows tier status, locks and "manage on the store where you subscribed".
- "Manage subscription" deep-links to the store's subscription page; account deletion does not cancel a store subscription (stated in the UI).

## 7. System surfaces

### 7.1 Home-screen widgets (`InvestAOWidgets/**`, `Core/Widgets/**`, `docs/home-screen-widgets.md`)

Four widgets, 11 size configurations. The widget extension has no network access: the app writes small snapshots to a shared container and the widgets render them. Public quotes are separate from account-scoped watchlist/portfolio snapshots; private snapshots are revoked on sign-out, session expiry, account deletion and account switch.

| Widget | Gallery name PT (EN) | Gallery description | Sizes | Content | Configuration | Tap |
|---|---|---|---|---|---|---|
| Market | `Mercado invest.ao` (invest.ao market) | `Indicador proprietário e movimentos dos instrumentos, com base em cotações BODIVA.` | Small, Medium, Large | Indicator value and change, market status (`Mercado aberto` / `Mercado fechado` / `Abertura em breve` / `Mercado indisponível`), recent indicator trend (≤30 points), strongest rise and fall (`Maior subida` / `Maior descida`, or `Sem movimento`); labelled `Indicador invest.ao · não é índice oficial da BODIVA` / `Índice não oficial`; `Variações incompletas` when comparisons are partial | none | `investao://market` |
| Watchlist | `Acompanhar` (Follow); small widget is titled `A acompanhar` | `Cotações dos instrumentos da tua lista de acompanhamento.` | Small, Medium, Large | Small: one featured instrument (price, change). Medium/Large: readable list of watched instruments with price and change | Small only: `Instrumento em destaque` — pick from the actual watchlist; falls back to the first watched item if removed | `investao://watchlist`; rows and the small featured item open their instrument |
| Instrument | `Instrumento` | `Escolhe um instrumento para acompanhar a sua cotação e variação.` | Small, Medium | Cached quote, session change, issuer shown once; medium adds `Histórico de fecho` sparkline labelled with the real number of closing observations (`Sem histórico` when none) | Searchable picker over the cached catalogue (`Escolhe um instrumento carregado no invest.ao. Abre a aplicação para atualizar a lista.`) | `investao://security?id=…` (market when unconfigured) |
| Portfolio | `Carteira` | `Valor e desempenho das posições registadas no invest.ao.` | Small, Medium, Large | Current valuation, `Resultado não realizado` (or `Resultado parcial` beside the value when quotes are missing), number of positions; Large adds `Maiores posições` | none | `investao://portfolio`; large position rows open their instrument |

Rules

- Prices are neutral text; colour and arrows belong to changes. Missing change → `Variação indisponível`, never a flat market.
- No freshness/date footer; stale source data prevents an old status from showing as current.
- Refresh: timelines re-read the cache after 30 min when the last reported session was open/opening, otherwise 2 h; the app also refreshes snapshots opportunistically in the background and only reloads widget kinds whose content changed.
- Portfolio values follow the current-quote policy: an expired or legacy snapshot loses value, P/L, percentages and rankings but keeps positions.
- Privacy: portfolio values are hidden by default (opt-in in Settings); privacy mode always masks them.
- Empty/signed-out hints: `Abre o invest.ao para carregar os dados do mercado.`, `Abre o invest.ao para carregar a tua lista.`, `Adiciona instrumentos à tua lista no invest.ao.`, `Edita o widget para escolher um instrumento.`, `Abre o invest.ao para atualizar este instrumento.`, `Abre o invest.ao para carregar a tua carteira.`, `Regista as tuas posições no invest.ao.`, footer link `Abrir invest.ao →`.
- Background uses the app canvas token; no tier gating on any widget.
- Exact per-size layouts were taken from the widget doc's information hierarchy, not from a line-by-line read of each view: pixel-level layout is `UNVERIFIED`.

Android equivalent: four Jetpack Glance app widgets with resizable layouts (small/medium/large breakpoints), a configuration activity for the Instrument and small Watchlist widgets, WorkManager refresh, deep links into the same destinations. Web equivalent: none (optionally an installable PWA; no widget surface).

### 7.2 Live Activity — BODIVA session (`InvestAOWidgets/MarketSession`, `App/LiveActivity`)

- Opt-in: Settings → `Ecrã bloqueado` → `Sessão da BODIVA` (default off). Requires system Live Activities permission.
- Starts when the app is foregrounded on a trading day **before that day's close** (so it can show before the open); ends immediately when disabled, when there is no session today, or after the close (it goes stale at the closing time). Only one runs at a time.
- Lock screen: venue label `BODIVA` with a building icon, a right-aligned timer, and a progress bar from open to close; white on a translucent black tint.
- Timer text: `Abre {hora}` before the open; a live countdown to the close during the session; `Fechada` after close or when stale.
- Dynamic Island: compact = building icon + countdown; minimal = building icon; expanded = venue, timer, progress bar.
- Tap opens Home (`investao://market`).
- No prices, no account data.

Android equivalent: an opt-in ongoing notification with a chronometer/progress (Android 16 "Live Updates" / promoted ongoing notification where available), started by the app or a scheduled worker on trading days. Web: none.

### 7.3 Spotlight (`App/Spotlight/SpotlightIndex.swift`)

- Indexes every listed instrument (same visibility rule as Explore). Re-indexed only when content changes.
- Title = symbol. Description = `{nome} · {preço} · {variação %} · {dd/MM}` when a display price exists, else `{nome} · {tipo}`. Keywords = symbol, name, `BODIVA`.
- Tapping a result opens that instrument's detail.

Android equivalent: none required at launch; closest is App Search / dynamic shortcuts for recently viewed instruments. Web: indexable public instrument pages with structured data (if the web app exposes public pages).

### 7.4 Siri / Shortcuts (`App/Intents/InvestAOShortcuts.swift`)

| Intent | Title PT (EN) | Invocation phrases (PT) | Parameter | Result |
|---|---|---|---|---|
| Quote | `Cotação de um instrumento` (Instrument quote) | `Cotação de {instrumento} no invest.ao`; `Preço de {instrumento} no invest.ao` | Instrument (searchable by symbol or name, from the cached catalogue) | Spoken/visual answer without opening the app: `{símbolo}: {preço} ({variação})` plus a card with name, price, coloured change and `{rótulo do preço} · {dd/MM}`; or `Sem cotação disponível para {símbolo}.` |
| Open instrument | `Abrir instrumento` | `Abrir {instrumento} no invest.ao` | Instrument | Opens the app on that instrument |
| Open portfolio | `Abrir carteira` | `Abrir a minha carteira no invest.ao`; `Carteira no invest.ao` | — | Opens Portfolio tab |
| Open watchlist | `Abrir lista` | `Abrir a minha lista no invest.ao` | — | Opens Watchlist tab |

Short titles: `Cotação`, `Abrir instrumento`, `Carteira`, `Lista`. Phrases are authored in Portuguese only.

Android equivalent: static + dynamic App Shortcuts (Portfolio, Watchlist, Search) and optionally Assistant App Actions for "open instrument"; the voice quote answer has no simple equivalent. Web: none.

### 7.5 Notifications as the user sees them

Permission: asked in context — after the first watchlist add, after saving an alert, from Settings → Notifications, and when enabling income reminders. Options: alert, badge, sound. Never asked on first launch.

Foreground behaviour: pushes received while the app is open are shown as a banner with sound and kept in the notification list (since 1.1.4). A silent push can announce a watchlist move and trigger a background refresh.

No custom notification action buttons or categories were found in the code read; the only interaction is tap-to-open. Badge count rules: `UNVERIFIED` (badge permission is requested; no client-side badge logic was found).

Lock-screen privacy: by default remote notifications use generic text; public facts appear only when `Mostrar factos públicos nas notificações` is on; personal amounts and the user's relationship to an instrument never leave the app.

| Type (push category) | Title PT (EN) | Body PT | Opens | Controlled by |
|---|---|---|---|---|
| Generic fallback | `Nova informação em invest.ao` | `Abra a aplicação para consultar a atualização.` | App | — |
| Custom price alert (target) | `Preço alvo atingido` / `O seu alerta de preço foi atingido` | `{SÍMBOLO} atingiu o limiar de {valor}.` / `Abra o título para consultar o alerta.` | Instrument | The alert rule itself (2.9) |
| Custom change alert | `Variação superior a` … | `{SÍMBOLO} {subiu/desceu} {x}%, de {a} para {b} Kz.` | Instrument | Alert rule |
| 52-week high / low | `Máximo de 52 semanas` / `Mínimo de 52 semanas` | `{SÍMBOLO} atingiu um máximo/mínimo de 52 semanas.` | Instrument | Alert rule |
| Volume above average | `Volume acima da média` | `{SÍMBOLO} negociou {n}× ou mais o volume médio.` | Instrument | Alert rule |
| Days without trades | `Dias sem negócios` | `{SÍMBOLO} está há {n} dias sem negócios.` | Instrument | Alert rule |
| Automatic movement (`asset_movement`) | Voice variants: `Tem movimento em {S} 👀`, `{S} está a mexer`, `{S} acordou com vontade 📈`, `{S} hoje não veio brincar 📈`, `{S} levou um abanão 👀`, `Isto já merece atenção 👀`, `Um dos teus favoritos está a mexer`; generic `Movimento relevante` | `{S}: {x}% face ao último fecho.` / `{S}: {x}% entre negociações em até 5 min.` / generic `Há um movimento de mercado verificado. Abre a aplicação para consultar.` | Instrument | Watchlist movement toggle per instrument + sensitivity Low/Normal/High; Free = 1 instrument |
| Daily close (`daily_close`) | `Fecho da BODIVA` | `{n} em alta e {m} em baixa. Maior variação: {S} {x}%.` / `Nenhuma ação mudou de preço.` (+ `Na tua lista: {n} em alta e {m} em baixa.`) | Activity / article | `Fecho diário da BODIVA` |
| Market recap article (`market_recap`) | `Novo resumo de mercado` / `Fecho das acções` | `{título}. Abre a aplicação para ler a publicação.` | Article | `Receber o fecho das acções` |
| News (`news_publication`) | `Nova notícia na invest.ao`, `Há novidades sobre {S}` | publication title | Article | Articles and recaps setting |
| Portfolio daily (`portfolio_daily`) | `A tua carteira ganhou terreno` / `Hoje a carteira recuou` / `A tua carteira em movimento` | generic on lock screen; detail in app | Portfolio insight sheet | `Variação diária da carteira`, `Movimentos das tuas posições` |
| New listing (`market_listing`) | `Nova admissão à BODIVA`; voice `{Emitente} chegou à BODIVA 👀`, `Novo na BODIVA`, `Newcomer in the building! 👋` | `Uma nova admissão à BODIVA foi confirmada.` / `{Emitente} já está oficialmente em negociação na BODIVA.` | Instrument / listing page | `Novas admissões confirmadas` |
| Weekly Wrap (`weekly_wrap`) | `O teu Weekly Wrap está pronto`; voice `O mercado, pelos números`, `A tua carteira, pelos números`, `A tua lista, ao fecho`, `Vamos ver o que mexeu 👀` | `Revê a semana no mercado. Abre o Wrap e vê os destaques.` | Wrap player | — (`UNVERIFIED` which toggle) |
| Unusual activity — trade | `Negócio em {S}` | `Alguém acabou de comprar {n} ações de {S} a {preço} por ação.` (variants for bonds, fund units, units) | Instrument | `Atividade invulgar` → `Títulos que sigo` + rule toggles |
| Unusual activity — order | `Ordem de compra em {S}` / `Ordem de venda em {S}` | `Alguém colocou uma ordem de compra/venda de {valor} a {preço}.` | Instrument | same |
| Unusual activity — session | `Atividade invulgar em {S}` | `Negociou {n}× o volume habitual.` / `{n} negócios, {k}× o habitual.` / `Subiu/Desceu {x}% no fecho, {k}× a variação típica.` / `Primeiro negócio em {n} sessões.` / `Diferença entre compra e venda {k}× maior que o habitual.` | Instrument | same |
| Unusual activity — digest (`unusual_activity`) | `Atividade invulgar` | `{A} teve atividade fora do habitual hoje.` / `{A} e {B} tiveram…` / `{A}, {B} e mais {n} títulos que segues tiveram…` | Unusual activity sheet | same |
| Quiet/empty voice | `Mercado em modo tranquilo`, `Hoje a BODIVA decidiu descansar ☕️`, `O teu radar ainda está vazio`, `Quem vais acompanhar?` | — | App | — |
| Income reminder (local) | payment-day reminder at 09:00 Luanda | — | Portfolio income calendar | Plus; enabled from the income calendar |

Global limits stated to the user: `Até cinco avisos opcionais por dia. Entre as 20h e as 8h, o radar fica em silêncio.`

Android equivalent: FCM with notification channels mirroring the settings groups (price alerts, automatic movements, daily close, articles and recaps, portfolio, new listings, unusual activity, weekly wrap, reminders), Android 13+ runtime permission asked at the same contextual moments. Web: optional Web Push for the same types, plus the in-app Activity center as the reliable channel.

### 7.6 Deep links

Custom scheme only (`investao://`). **There are no universal links**: neither `Invest.AO/Invest.AO.entitlements` nor `Configuration/Widgets.entitlements` declares associated domains (they hold push, Sign in with Apple and the shared app group only).

| URL | Destination |
|---|---|
| `investao://market` | Home |
| `investao://watchlist` | Watchlist tab |
| `investao://portfolio` | Portfolio tab |
| `investao://security?id={id}` | Instrument detail |
| `investao://wrap/{period-key}` | Weekly Wrap for that period |
| (web, referenced by the app) `https://invest.ao/policy` | Privacy policy |
| (web, referenced by Pro share links) `/partilha/{token}` | Read-only portfolio page |

Android/web should add verified `https://invest.ao/...` links (App Links) for instrument, article, wrap and shared-portfolio pages so one URL works on every platform.

## 8. Product rules to inherit

### 8.1 Repo `AGENTS.md` (product direction and UI rules)

1. Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
2. Always choose what improves user, developer and agent experience together, without breaking anything.

- Product: make the Angolan capital market easier to understand, monitor and follow for **retail investors**, starting with BODIVA securities and market information.
- Should feel modern, premium, trustworthy, data-focused, approachable, native to its platform, relevant to Angola. Should not feel like a bank app, a Bloomberg terminal, a generic crypto app, corporate, cluttered, template-driven or noisy.
- Financial information is the visual hero. Do not turn every section into a rounded card. Do not copy crypto terminology or crypto interaction patterns.
- Prefer platform frameworks over third-party UI dependencies; any new dependency needs justification. Optimise for correctness, maintainability, readability, native behaviour, accessibility, performance, testability, consistency.
- Scraping, ingestion and server-side notification generation belong to the backend, not the client.
- Never mention AI tools or AI authorship in commits, source, docs or metadata.

### 8.2 `README.md`

- App and widgets support Portuguese and English, follow the device language, and the per-app language setting also controls push language.
- Authored news, issuer names and source documents keep their published language. Financial inputs keep comma-decimal editing.
- Forced-update and maintenance screens are remote-controlled. Analytics are installation-based with fixed screen names and sanitised errors; crash reporting is separate.

### 8.3 Decisions defined in `docs/`

| Doc | Rules to carry over |
|---|---|
| `current-quote-policy.md` | A price is "current" only with valid unexpired quality, matching Luanda trading date and unexpired calendar; revoke on offline, failed refresh, unknown calendar, prior session, backgrounding. Never substitute zero. History, positions and records remain available. Outside a session only a dated verified close is shown and it never feeds valuation |
| `verified-closing-prices.md` | Show `Último fecho verificado` + date; keep instruments without a close visible (except matured bonds); a failed closing request keeps the already loaded reference; closing reference cannot authorise simulation, valuation, alerts or insights; indicator explained as invest.ao composite |
| `facts-insights-presentation.md`, `intelligence-foundation.md` | Three layers: verified facts → insights (significance, freshness, novelty) → presentation. Presentation never computes numbers. Every insight carries sources, calculation version, period and limits and has an explanation view. Omit rather than estimate |
| `home-context-priority.md` | One contextual slot; priority table by market state (2.1); no personal amounts on Home; privacy mode suppresses personal content; nothing shown with an unknown calendar or offline |
| `weekly-wrap.md`, `weekly-wrap-phase1.md` | Wrap is a verified, immutable weekly snapshot per account; baseline = last close before the week; all sessions verified; personal stories omitted rather than estimated; bounded availability window; replayable offline; "data and method" always available (2.10) |
| `week-ahead-phase7.md` | Only sourced, already-announced dates; dividends only today; no forecasts; explicit "announced" wording; relationship badges do not imply entitlement; empty coverage is explained, not presented as "no events" |
| `saturday-discover-phase6.md` | Finite (≤5), deterministic, diversity-capped Saturday selection; hard freshness and consumption gates; no learned ranking |
| `editorial-news.md` | News is authored editorial content with sources; Markdown subset rendered natively; safe links only; articles stay in the archive (2.11) |
| `investment-simulator.md` | Illustrative projections only; requires a fresh current quote; whole units for stocks, fractional for funds; explicit non-execution disclaimer and methodology (2.8) |
| `market-listing-events.md` | New admissions are sourced events with lifecycle upcoming → today → confirmed → recently listed; never fabricate a security, quote, chart or watchlist entry for an unlisted issuer; launch notification only after explicit sourced confirmation with a linked security; lock-screen copy stays generic |
| `market-calendar-foundation.md` | All session knowledge comes from a verified calendar; unknown is a real state; weekdays alone prove nothing; Africa/Luanda everywhere |
| `data-quality-foundation.md`, `quote-availability-investigation.md` | Data-quality states are surfaced as explicit reasons (2.6); unavailable is better than wrong |
| `privacy-mode.md` | Section 5.1 |
| `PERSONALIZATION_DECISIONS.md`, `user-feedback-personalization-phase21.md` | Section 5.2 |
| `contextual-reviews.md` | Section 5.4 |
| `global-error-handling.md` | Section 5.6 |
| `activity-center-phase5.md` | Activity is an inbox of events, one row per event, with typed routing, retention 56 days / 200 items (2.13) |
| `account-deletion.md` | In-app, irreversible deletion of profile, portfolio, watchlist, alerts and notification history; provider account remains; store subscription must be cancelled separately |
| `subscription-*.md` | Section 6; enforcement is a server switch independent of the client flag; existing data is never deleted on downgrade |
| `home-screen-widgets.md` | Section 7.1 |
| `product-copy.md` | Section 4.1 |

Independence statement to keep on every surface: invest.ao is independent and **not affiliated with BODIVA**; it does not allow buying or selling securities and gives no financial advice.

## 9. Store listing

Source: `fastlane/metadata/pt-PT/*`, `docs/app-store-aso.md`, `docs/release-notes-*.en.txt`, `Configuration/*`, project settings.

### 9.1 Identity

| Field | Value |
|---|---|
| App name | `invest.ao: Bolsa de Angola` |
| Subtitle | `Acções, obrigações e cotações` |
| Bundle id / store id | `ao.invest.iosapp` / `6812907673` (`https://apps.apple.com/app/id6812907673`) |
| Version | 1.1.5 (18) |
| Minimum OS / devices | iOS 26.0, iPhone only |
| Listing localization | One: Portuguese (Portugal) `pt-PT`, also the primary language. **Deliberately no English listing** (it would replace the Portuguese listing in the Angola storefront) |
| In-app languages | Portuguese, English |
| Categories, age rating, support/marketing URLs, screenshots captions, privacy nutrition labels | `UNVERIFIED / not in repo` (only name, subtitle, keywords, promo text, description and release notes are stored) |
| Privacy policy | `https://invest.ao/policy` |
| Terms | Apple standard EULA `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` |
| In-app purchases | Plus monthly/annual, Pro monthly/annual, 7-day trial (section 6) |
| Previous live values | name `Invest.AO`, subtitle `Mercado angolano, mais claro` |

### 9.2 Promotional text (verbatim)

> Acompanha a bolsa de Angola num só sítio: cotações, gráficos, comparações e alertas. Regista a tua carteira e vê o valor estimado, sem ligação ao banco.

(EN gloss: Follow Angola's stock market in one place: quotes, charts, comparisons and alerts. Record your portfolio and see its estimated value, with no bank connection.)

### 9.3 Keywords (verbatim, 98/100 characters)

`bodiva,ações,mercado,capitais,valores,investimentos,investir,títulos,tesouro,kwanza,carteira,stock`

Rules: comma-separated, no spaces, never repeat a word from name or subtitle; `bodiva` stays out of visible fields except as the data source with the independence disclosure; no issuer brands or competitor names; visible copy uses `acções`, keywords add `ações`.

### 9.4 Description (verbatim)

> Acompanha a bolsa de Angola com o invest.ao. Consulta as cotações das acções e obrigações negociadas na BODIVA, compara a evolução dos preços e organiza a tua carteira de investimentos.
>
> MERCADO E COTAÇÕES
> Pesquisa títulos, consulta as cotações disponíveis e explora gráficos com o histórico de cada período. Cada preço mostra a data e o tipo de referência.
>
> ACTIVIDADE INVULGAR
> Vê quando um título negoceia fora do habitual e recebe alertas sobre esses movimentos.
>
> COMPARAÇÃO
> Coloca vários títulos no mesmo gráfico e compara a sua evolução com base no histórico disponível.
>
> LISTA DE ACOMPANHAMENTO E ALERTAS
> Guarda os títulos que queres seguir. Define alertas de preço ou de variação e recebe movimentos automáticos.
>
> CARTEIRA
> Regista as tuas compras com quantidade, preço e data. Acompanha o valor estimado e o ganho ou perda, sem ligação ao banco ou à corretora. O modo de privacidade esconde os valores.
>
> SIMULADOR
> Testa cenários com um valor inicial, contribuições mensais e uma variação anual à tua escolha.
>
> NOTÍCIAS E RESUMOS
> Lê notícias do mercado, vê as datas já anunciadas para a semana seguinte e revê o resumo de cada semana.
>
> WIDGETS
> Acompanha o mercado, os teus títulos e a tua carteira no ecrã principal.
>
> INVEST.AO PLUS
> O plano gratuito permite guardar até 3 instrumentos, receber movimentos automáticos em 1 instrumento e fazer 1 comparação de 2 instrumentos por semana.
>
> Com o Plus, guardas até 500 instrumentos, recebes movimentos automáticos em todos os guardados e comparas até 3 instrumentos sem limite semanal.
>
> Escolhe uma subscrição mensal ou anual. Os preços, as ofertas e a elegibilidade para um período experimental são apresentados na app antes da compra. A subscrição renova-se automaticamente, salvo cancelamento nas definições da Conta Apple. Após um período experimental, é cobrado o preço do plano escolhido, salvo cancelamento antes da renovação.
>
> SOBRE OS DADOS
> O invest.ao é independente e não é afiliado à BODIVA. Não permite comprar ou vender títulos nem presta aconselhamento financeiro. As cotações podem ter atrasos e dependem da disponibilidade das fontes. Os valores da carteira são estimativas baseadas nos teus registos e nas cotações disponíveis.
>
> Política de privacidade: https://invest.ao/policy
> Termos de utilização (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Listing rules from the brand kit: no trial length or prices in the description, no forecast language.

### 9.5 Release notes

1.1.5 (PT, verbatim from `release_notes.txt`)

> • Carteira: regista depósitos, levantamentos e comissões.
> • Importa extractos da corretora a partir de fotos e PDF.
> • Relatório anual de mais-valias e rendimentos em PDF.
> • Histórico de preços completo, com exportação em CSV.
> • Novos alertas: máximos e mínimos de 52 semanas, volume e inactividade.
> • Organiza a lista em grupos.
> • Liquidez de cada título.
> • Resumo diário do fecho da BODIVA.
> • Aprender: lições curtas sobre a BODIVA, acções e obrigações.
> • Convida amigos e ganha meses de Plus.
> • Todas as notícias publicadas ficam no arquivo.
> • Entrada com Google mais rápida.
> • Mais estável quando a ligação ou o servidor falham.

1.1.4 (EN): Plus subscription (monthly/annual, 7-day trial; watchlist up to 500, every saved alert, unlimited comparisons); several named portfolios; portfolio vs inflation and reference rates; bond yield to maturity; income calendar with totals and reminders; unusual activity grouped by security with shares before bonds; notifications shown while the app is open.

1.1.3 (EN): Unusual activity with alerts; portfolio income, fees and bonds, CSV export/import; Siri and Shortcuts; Spotlight; BODIVA session on the Lock Screen and Dynamic Island; redesigned alerts and faster quote updates.

### 9.6 Creative assets in the repo

`Design/AppStoreCreativeAssets`: `invest-ao-cabecalho.png` (header), `invest-ao-resultado-pesquisa.jpg` (search-result card), `asset-detail.png`, `asset-comparison.png`, `palanca-white.png`, and the HTML/render script that produces them. `Design/AppIcon`: master SVG and generator page. Captions and screenshot order were not read: `UNVERIFIED`.

### 9.7 Seed for Play Store and website (derived from the copy above, not existing text)

| Field | Suggested value | Limit |
|---|---|---|
| Play title | `invest.ao: Bolsa de Angola` | 26/30 |
| Play short description | `Cotações, gráficos, comparações e alertas da bolsa de Angola. Regista a carteira` | 80/80 (no trailing full stop) |
| Play full description | Reuse 9.4, replacing `Conta Apple` with the Google Play wording, `ecrã principal` widgets paragraph only if Android widgets ship, and the EULA line with the product's own terms URL | 4 000 |
| Website hero | `O mercado angolano num só lugar` (sign-in title) or `O teu mercado, de perto.` (existing string `common.yourMarketUpClose`) | — |
| Website sub-hero | Promotional text 9.2 | — |
| Website sections | The description's headings: Mercado e cotações, Actividade invulgar, Comparação, Lista e alertas, Carteira, Simulador, Notícias e resumos, Widgets, Plus, Sobre os dados | — |

Play requires fields the repo does not hold: category (Finance), content rating questionnaire, data-safety form, a privacy policy URL and an account-deletion URL.

## 10. Prioritized parity checklist

Tags: `core` = the product is pointless without it; `standard` = expected at launch parity; `platform-specific` = iOS-only surface that needs a different Android/web answer.
Web tag: `web: yes` = build as-is in the web app; `web: adapt` = makes sense with a different mechanism (noted); `web: no` = does not apply to a browser.

Finer-grained per-feature lists (without the web tag) are at the end of sections 2.9, 2.C3 and 2.13.

**Shell, account, onboarding**

- Five primary destinations: Home, Explore, Portfolio, Watchlist, Search — `core` — web: adapt (side/top navigation on desktop, bottom bar on mobile web)
- Sign in with Google — `core` — web: yes
- Sign in with Apple — `standard` — web: yes (OAuth redirect); Android uses the web flow
- Session restore, expiry handling and re-auth prompt — `core` — web: yes
- Whole app behind sign-in on first use — `standard` — web: adapt (decision needed: public market pages are natural on web)
- Three-page first-launch introduction — `standard` — web: adapt (becomes the marketing landing page)
- Post-login setup: optional name, first watchlist picker with search and category chips, resumable draft — `standard` — web: yes
- One-time paywall offer after onboarding for Free accounts — `standard` — web: adapt (depends on web billing decision)
- Profile sheet with identity card and all settings — `core` — web: yes
- Sign out with full local cache clearing — `core` — web: yes
- In-app irreversible account deletion with re-authorisation and confirmation — `core` — web: yes (also the Play-required deletion URL)
- Theme setting System / Light / Dark — `standard` — web: yes
- Language PT/EN following device, per-app override, localized pushes — `standard` — web: adapt (in-app language switch + browser language)
- Forced-update screen driven by a remote minimum version — `standard` — web: no (web is always current)
- Maintenance screen driven by a remote flag — `standard` — web: yes
- Deep links for market, watchlist, portfolio, instrument, wrap — `standard` — web: adapt (these become real URLs/routes; add verified https links on Android)
- Pending route retained through launch, onboarding and sign-in — `standard` — web: yes (return-to URL after login)

**Market data and rules**

- Instrument catalogue with kinds: stocks, corporate bonds, fund units, treasury bonds — `core` — web: yes
- Current-quote policy: show a price as current only with valid evidence; otherwise `Preço por confirmar`, never zero — `core` — web: yes
- Dated verified closing price with label and date — `core` — web: yes
- Explicit reasons when a price cannot be confirmed — `standard` — web: yes
- Market status (open / closed / opening soon / unavailable) from a verified Luanda calendar, 09:00–15:30 default — `core` — web: yes
- Bond prices as % of par and changes in percentage points — `core` — web: yes
- Matured bonds hidden outside search — `standard` — web: yes
- Foreground auto-refresh 30 s open / 60 s closed / 120 s with realtime announcements, exponential backoff — `core` — web: yes (pause when tab hidden)
- Quotes revoked when the app is backgrounded or offline — `standard` — web: adapt (revoke on tab hidden/offline)
- Offline banner and cached dated closes — `standard` — web: adapt (online/offline events; smaller cache)
- invest.ao Indicator (equal-weight, base 100) with methodology sheet and "not an official BODIVA index" label — `standard` — web: yes
- Thin-market handling: no-trade sessions, disabled 1D, explicit empty copy — `standard` — web: yes

**Home**

- Market overview card: indicator value, change, sparkline, session volume and trades, status — `core` — web: yes
- Market session detail: index chart with ranges, gains/declines counts, metrics — `standard` — web: yes
- Watchlist rail (up to 6) with empty call-to-action — `core` — web: yes
- Movement feed tabs Gains / Declines / Volume, top 3 — `core` — web: yes (can show more on desktop)
- News section, up to 3 — `core` — web: yes
- Market updates section, up to 3 — `standard` — web: yes
- Single context slot with market-state priority (Friday Wrap, Saturday Discover, Sunday Week ahead) — `standard` — web: yes
- Saturday Discover deterministic selection (≤5, diversity caps) — `standard` — web: yes
- Available-summaries recap menu — `standard` — web: yes
- New-listing highlight with lifecycle and one-time reveal — `standard` — web: yes (wiring on iOS Home UNVERIFIED)
- Bell with unread state, Unusual-activity shortcut, profile initials — `core` — web: yes
- Skeleton loading, error with retry, stale-data fallback with saved Wrap/agenda — `standard` — web: yes
- Pull to refresh — `standard` — web: adapt (refresh button + auto-refresh)
- Two-pane Home across a device fold — `platform-specific` — web: adapt (responsive two-column desktop layout; Android foldables)

**Explore and Search**

- Category filter All / Stocks / Bonds / Funds / Treasury — `core` — web: yes
- Sort by change / price / volume / name with direction toggle — `core` — web: yes (sortable table on desktop)
- Text search over symbol, name, issuer, accent-insensitive — `core` — web: yes
- Empty states with "clear filters" — `standard` — web: yes
- Session data disclosure (published time, traded securities, transactions) — `standard` — web: yes
- Entry points to News, Learn, Market information — `standard` — web: yes
- Master–detail split on wide screens — `standard` — web: yes (default desktop layout)
- Search home: category cards with counts, recents (max 8, local), highest volume (6) — `standard` — web: yes
- Results grouped by kind, star toggle in the row — `core` — web: yes
- Recents stored on device and clearable — `standard` — web: yes (local storage)

**Asset details, comparison, alerts, simulator** (detail in 2.7–2.9)

- Price header with source-aware label, change, status — `core` — web: yes
- Interactive chart with ranges 1D–1A and scrubbing — `core` — web: yes (hover crosshair)
- Full history range, Plus — `standard` — web: yes
- Intraday 5-minute chart with notices — `standard` — web: yes
- Overview / About / Orders tabs: performance, statistics, market info, issuer, dividends, reports — `core` — web: yes
- Liquidity section, Plus — `standard` — web: yes
- Order book (5 levels; full depth Pro), auto-refresh 60 s — `standard` — web: yes
- Bond facts and yield-to-maturity calculator — `standard` — web: yes
- Pre-admission listing page — `standard` — web: yes
- Follow/unfollow from the instrument — `core` — web: yes
- Share instrument as text — `standard` — web: adapt (copy link / Web Share)
- Export price history CSV, Plus — `standard` — web: yes (download)
- Compare up to 3 instruments as % change with common-interval rule and weekly Free limit — `standard` — web: yes
- Share comparison as a branded 9:16 image — `platform-specific` — web: adapt (download PNG)
- Price / change / 52-week / volume / inactivity alert rules; list, edit, pause, delete; Free limit 2 — `core` — web: yes
- Automatic movement alerts per watched instrument with sensitivity — `standard` — web: yes (settings); delivery adapt
- Investment simulator with presets, projection chart, methodology and disclaimers — `standard` — web: yes
- In-app browser for sources — `platform-specific` — web: adapt (new tab); Android Custom Tabs
- Persistent bottom action bar on detail — `platform-specific` — web: adapt (sticky action row)

**Portfolio and Watchlist** (detail in 2.C1–2.C3)

- Manual ledger: buy, sell, income for stocks, funds, bonds; editor with validation — `core` — web: yes
- Dashboard: value, period change, value chart, positions, allocation, summary — `core` — web: yes
- Position detail with average cost, realised and unrealised results — `core` — web: yes
- Weighted-average cost method — `core` — web: yes
- Multiple named portfolios, Plus — `standard` — web: yes
- Cash movements and total result, Plus — `standard` — web: yes
- Benchmark vs inflation and rates, Plus — `standard` — web: yes
- Results by year and yearly PDF report, Plus — `standard` — web: yes
- Income calendar; totals, Plus — `standard` — web: yes
- Payment-day reminders, Plus — `platform-specific` — web: adapt (web push or email) / Android local notification
- CSV export and import with review — `standard` — web: yes
- Statement reader (photo/PDF OCR), Plus — `platform-specific` — web: adapt (file upload + client or server OCR) / Android ML Kit
- Read-only share links, Pro — `standard` — web: yes (the public page lives on the web)
- Portfolio weekly reading tiles with explanation sheets — `standard` — web: yes
- Watchlist list, add sheet, reorder, remove with undo — `core` — web: yes (drag reorder)
- Swipe actions on rows — `platform-specific` — web: adapt (row menu/hover actions)
- Watchlist groups, Plus — `standard` — web: yes
- Free plan active/paused instrument chooser — `standard` — web: yes
- Watchlist weekly reading with dismiss / not useful feedback — `standard` — web: yes

**Content: Wrap, News, Learn, Activity, Week ahead, Unusual activity**

- Weekly Wrap story player with verified snapshot, data-and-method sheet, archive — `standard` — web: yes (keyboard/click navigation)
- Wrap soundtrack and haptics — `platform-specific` — web: adapt (optional audio, no haptics)
- Wrap MP4 video share — `platform-specific` — web: adapt (link share or image; video optional)
- News feed, archive with paging and search, article detail with sources and related instruments — `core` — web: yes (strong SEO surface if public)
- Article story-image export — `platform-specific` — web: adapt (Open Graph image / download)
- Market information screen with category chips and update detail — `standard` — web: yes
- Learn: seven bundled lessons with read state — `standard` — web: yes
- Activity center inbox: filters, grouping, read state, typed routing, retention — `core` — web: yes (primary notification channel on web)
- Week ahead agenda of announced dividend dates with sources — `standard` — web: yes
- Unusual activity list grouped by instrument with signal lines and disclaimer — `standard` — web: yes
- Unusual-activity rule toggles — `standard` — web: yes

**Cross-cutting**

- Privacy mode: mask personal values, unitless portfolio trend, id-sorted holdings — `standard` — web: yes
- App-switcher privacy cover — `platform-specific` — web: no; Android FLAG_SECURE / recents cover
- Personalised ordering with reset controls and local novelty receipts — `standard` — web: yes
- Contextual store-review prompt (3 tasks / 2 sessions / 90 days / once per version) — `platform-specific` — web: no; Android Play In-App Review
- Global error presentation: in-screen error states, single retry toast, grouped retries, no technical text — `core` — web: yes
- Freshness labels on values and "saved" labels on cached intelligence — `core` — web: yes
- Skeletons and shimmer loading — `standard` — web: yes
- Haptics for selection/success — `platform-specific` — web: no; Android haptics
- Dynamic Type restacking layouts — `standard` — web: adapt (responsive + browser zoom/rem scaling)
- Screen-reader labels, combined rows, chart summaries — `standard` — web: yes (ARIA)
- Increased-contrast palette and Reduce Motion fallbacks — `standard` — web: yes (`prefers-contrast`, `prefers-reduced-motion`)
- Light and dark themes with identical tokens — `core` — web: yes
- Custom 56-icon rounded pack — `standard` — web: yes
- PT/EN formatting: pt_AO separators, AOA, signed percents, p.p., compact axes, Luanda time zone — `core` — web: yes
- Comma-decimal amount input with live grouping — `standard` — web: yes

**Subscriptions**

- Free / Plus / Pro tiers with server-enforced limits — `core` — web: yes (enforcement and status)
- Plans screen with comparison tables, annual/monthly selection, 7-day trial, renewal disclosures — `standard` — web: adapt (billing channel decision; show status and store-management guidance at minimum)
- Lock → paywall with reason → resume blocked action once — `standard` — web: yes
- Restore purchases and refresh status — `platform-specific` — web: adapt (refresh status only)
- Manage subscription link to the store — `platform-specific` — web: adapt (link to the store where purchased)
- Downgrade keeps data; choose 3 active instruments + 1 movement instrument — `standard` — web: yes
- Referral: share code, redeem code within 30 days of account creation, credit until date — `standard` — web: yes
- Lifetime Plus gift announcement — `standard` — web: yes
- Family Sharing row — `platform-specific` — web: no

**System surfaces**

- Market, Watchlist, Instrument and Portfolio home-screen widgets (11 sizes) — `platform-specific` — web: no; Android Glance widgets
- Widget privacy opt-in for portfolio values — `platform-specific` — web: no
- BODIVA session Live Activity (lock screen + Dynamic Island), opt-in — `platform-specific` — web: no; Android ongoing notification
- Spotlight indexing of instruments — `platform-specific` — web: adapt (search-engine indexable instrument pages); Android optional App Search/shortcuts
- Siri/Shortcuts: quote answer, open instrument, open portfolio, open watchlist — `platform-specific` — web: no; Android App Shortcuts
- Push notifications for alerts, movements, daily close, recaps/news, portfolio, listings, wrap, unusual activity — `core` — web: adapt (Web Push optional; Activity center is the baseline)
- Contextual permission prompts and settings permission row — `platform-specific` — web: adapt (browser permission prompt on user action)
- Foreground banner presentation of pushes — `platform-specific` — web: adapt (in-app toast)
- Optional-notification toggles, five-a-day cap, quiet hours 20:00–08:00, public-facts toggle — `standard` — web: yes
- Generic lock-screen copy by default — `standard` — web: adapt (same payload rule for Web Push)
- Background snapshot refresh for widgets — `platform-specific` — web: no

## 11. Doc-vs-code disagreements and UNVERIFIED items

### 11.1 Where docs are stale (code reported above)

| Topic | Doc says | Code does |
|---|---|---|
| Colour hexes | `DESIGN_SYSTEM.md` / `LAYOUT_REDESIGN.md`: canvas `#F3F5F9`, accent `#175CD3`, primary text `#142137`, secondary `#526078`, action tile `#EAF0F8`, selected tile `#DCE8FB` | `SemanticColors.swift`: `#F2F3F5`, `#1854C5`, `#182231`, `#485364`, `#E5E9EF`, `#E2EAFA` (dark values match) |
| Translations | `product-copy.md`: "no translation catalogue" | `Localizable.xcstrings` with `pt` source and full `en` |
| Privacy toggle | `privacy-mode.md`: Settings and the portfolio eye button | Eye button only; no Settings row |
| Home header | `LAYOUT_REDESIGN.md`: "Profile/notifications header" | Native toolbar: initials, unusual-activity icon, bell; no greeting |
| Tab bar | `post-login-onboarding.md` mentions a "custom tab bar" | Native tab bar (`LAYOUT_REDESIGN.md` is the current one) |
| Home context | `home-context-priority.md` says Discover and Week ahead destinations "do not exist yet" | Both exist and are wired into the slot |
| Subscriptions | `subscription-foundation.md`: flag defaults to NO, Plus only | Production config is YES; Pro tier, referral and lifetime gift exist in code |
| Supported families | `home-screen-widgets.md`: "iPhone and iPad" | App target is iPhone-only |
| Tab order | `AppTab.swift` enum order (home, markets, portfolio, search, watchlist) | Rendered order: home, markets, portfolio, watchlist, search |
| Feature-level notes | See the "Doc vs code" subsections inside Asset details (2.7), Portfolio (2.C1) and Watchlist (2.C2) | — |

### 11.2 UNVERIFIED

- Home new-listing highlight: component and coordinator exist; no call site placing it in the Home layout was found.
- Home greeting strings and `HomeHeader` component: not seen in the live layout.
- Compact Home (`InvestAOCompactHomeEnabled`, false in the plist): an alternative bootstrap path for Home exists behind a flag; treated as off.
- Onboarding interests/goals strings: no screen found.
- Pro prices; which notification toggle governs Weekly Wrap pushes; badge-count rules; absence of notification action categories (no registration found in the files searched).
- Widget pixel-level layouts per size (taken from the widget doc).
- Component catalog rows were built from declarations and docs, not from a full read of every component file.
- Exact value text of the large-trade / large-order unusual-activity signal lines (label halves are verbatim; the value half is inferred).
- Store listing fields not in the repo: categories, age rating, screenshots and captions, support/marketing URLs, privacy nutrition labels.
- Android/web equivalents throughout are recommendations, not existing behaviour.

