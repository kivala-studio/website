# Layout

## Breakpoints

Tailwind's defaults plus one custom variant (`src/app/globals.css`):

| Prefix | From | Used for |
|---|---|---|
| `max-[20rem]:` … `min-[26rem]:` | 320–416 px | Narrow-phone fixes: hide a logo, a wordmark or a column (see [Tables on phones](#tables-on-phones)) |
| `sm:` | 640 px | 24 px gutters, wider table columns, fixed-width deck cards, the footer's two columns |
| `md:` | 768 px | Two summary cards per row, the side sheet, every table header sorts |
| `lg:` | 1024 px | **Page layout**: the top bar's nav capsule and its 88 px height, no bottom tab bar, sidebars, rails, sticky columns, `Panel` becomes a card, the two-column Plus card |
| `xl:` | 1280 px | Three summary cards on `/mercado`, two card columns on the portfolio dashboard, the widest table columns |
| `desk:` | 1024 px **and** `pointer: fine` | **Web scale**: type, small and medium radii, pill and field heights, card padding |

### `lg:` vs `desk:`

- `lg:` is about **space**: it moves things (columns, rails, navigation). It applies to any device 1024 px wide, touch or not.
- `desk:` is about **density**: it shrinks things (36 px price, 16 px body, 44 px pills, 8 and 12 px control corners, 24 px card padding). A touch screen never gets it, so touch targets keep iOS sizes on a large tablet.
- Layout goes on `lg:`; sizes, radii and padding go on `desk:`. `Card` becomes the web card on `desk:`; `Panel` becomes a card on `lg:` (it is a layout decision: on phones a `Panel` is a plain section).

## The page column

```ts
PAGE_CONTAINER = "mx-auto w-full max-w-300 px-4 sm:px-6"   // 1200 px max, 16 / 24 px gutters
READING_COLUMN = "mx-auto flex w-full max-w-3xl flex-col"   // 768 px, inside the container
SITE_PAGE      = PAGE_CONTAINER + "pt-4 pb-16 lg:pt-8"       // src/features/site/pages.tsx
SIGNED_IN_PAGE = PAGE_CONTAINER + "pt-4 pb-16 lg:pt-8"       // src/features/shell/placeholder-page.tsx
```

Every page's `<main id="main">` uses one of these. Market pages get theirs from `src/app/[locale]/(market)/mercado/layout.tsx` (`pt-4 pb-16 lg:pt-6`). The top bar's row sits in `PAGE_CONTAINER` too, so the logo and the last action line up with the page's edges at every width (the logo's pill and a round control overhang the gutter so their content lines up). The footer's band runs full width and its card is inset from the window's edges.

## Chrome

### Top bar (`TopBar`, `src/ui/components/top-bar.tsx`)

```
 (◆ invest.ao)        ( (Mercado) Notícias Aprender )        (🇬🇧 EN) (⚙) (Iniciar sessão)    88 px from 1024 px, sticky, z-30
   logo pill               nav capsule, centred                  opaque actions

Public site below 1024 px, menu open:
 ◆ invest.ao        (Iniciar sessão) (✕)      the bar: 64 px; three 48 px pieces, the round menu button ends it
 ╭───────────────────────────────────╮       the menu card, in the page column, under the bar
 │ (Mercado                        ) │       48 px font-display rows, current one on the soft tint
 │  Notícias                         │
 │  Aprender                         │
 │ ───────────────────────────────── │       hairline
 │ (Sistema|Claro|Escuro)       (EN) │       SiteControls
 ╰───────────────────────────────────╯
░░░░░░░ page dimmed (black/40), the bar's pieces above it ░░░░░░
```

One bar for the site and the app, and not a strip: three opaque pieces floating over the canvas, `sticky top-0 z-30`, with no background of their own, so the page passes under them (the header takes no clicks; only its pieces do). Its height is `--top-bar-height` (64 px, 88 px from 1024 px, `globals.css`); sticky columns, `scroll-padding-top` and anchors start under it. From 1024 px the row is a three-column grid: the logo on the left, the navigation centred on the page while both sides fit (it gives way to them when they don't: in the app the search pushes it a little left of centre), then the search and the actions on the right.

- **Logo:** a pill link (48 px, 56 px from 1024 px), bare on the canvas at the top of the page; it takes the card fill and the float shadow once the page scrolls (`top-bar-backing`).
- **Nav capsule:** a pill on the card fill with `TOP_BAR_PILL` links; the current one has `aria-current` and the soft accent fill, which glides to the next section.
- **Actions:** each brings its own opaque fill: `iconButtonClass("surface")`, the language pill on the card fill, the compact sign-in pill.
- Capsule and actions lift with `shadow-float` once the page scrolls under them (`TOP_BAR_FLOAT`).

| Mode | Who | Below 1024 px | From 1024 px |
|---|---|---|---|
| `mobileNav="menu"` | Public site (`SiteHeader` in `src/features/site/chrome.tsx`) | One row: the logo, the sign-in pill, then the round menu button at the end. The menu holds the sections, then `menu.content` (theme and language) | The capsule; `wideActions` before `actions`; no menu button |
| `mobileNav="none"` | Signed-in app (`ShellTopBar` in `src/features/shell/shell-nav.tsx`) | No capsule; the bottom tab bar has the tabs | The capsule; the search tab becomes the palette field |

Site actions: from 1024 px the language (`LanguageFlag` and code), `ThemeMenu` and the compact "Iniciar sessão" pill (links to `/entrar`); below 1024 px only the pill stays in the bar, 48 px tall like the logo and the menu button (`SIGN_IN_PILL`), and the theme (`ThemeSwitch`) and language sit in the menu as `SiteControls`. App actions: unusual activity and activity (surface icon links with `aria-current` on the soft tint, an unread dot), the profile initials (a 36 px disc in a 44 px link that overhangs the gutter by 4 px, so the disc ends on the page's edge). The wordmark shows from 360 px in the public bar and from 400 px in the app's (the link keeps its name).

The menu is a disclosure, not a WAI-ARIA menu: a 48 px round `surface` button (`menu`, `close` while open) with `aria-expanded` and `aria-controls` that ends the bar, then a panel that follows it in the DOM, so Tab goes from the button into the panel. The panel is a card (`rounded-card`, `shadow-panel`) in the page column that drops from under the bar (`motion-drop-in`, scrolls on its own if the window is short) over the dimmed page (`motion-dim-in`); the bar's pieces stay above the dim. While it is open the page doesn't scroll. Escape or a tap on the dimmed page closes it and returns focus to the button; following a link, tapping elsewhere on the bar, tabbing out of the menu (on to the logo, say) or widening the window past 1024 px closes it too. Without JavaScript the footer carries the same section links.

### Bottom tab bar (`ShellNav`)

Signed-in app only, below 1024 px: `fixed inset-x-0 bottom-0 z-20`, five tabs in iOS order (Início · Explorar · Carteira · Lista · Pesquisa, `TABS` in `destinations.ts`) on the canvas with a separator edge, icon over an 11 px label, the current one in `accent` with `aria-current="page"`, safe-area padding. The app shell adds `pb-20 lg:pb-0` so content clears it.

### Footer (`SiteFooter`)

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  stage-brand band, full width
▓ ╭ footer card (card fill) ───────────────────────────────────╮ ▓
▓ │ ◆ invest.ao                                     Produto      │ ▓  mark top left; one column of
▓ │                                                 Mercado      │ ▓  product links on the right
▓ │                                                 …            │ ▓
▓ │ disclaimers (captions, ≤ 672 px)                             │ ▓  bottom left (after the links
▓ ╰──────────────────────────────────────────────────────────────╯ ▓  on phones)
▓  © 2026 invest.ao                 Política · Termos · Suporte    ▓  on-stage-brand
```

Public pages only (the app has none). `SiteFooter({ year })` owns its band, `stage-brand`, so every public page closes the same way (on the landing it continues the closing band). On it, one big card on the card fill, inset from the window's edges (8 px, 16 px from 640 px, 24 px from 1024 px), at least 24rem tall from 1024 px: the home link (mark and wordmark) top left, the product links (`Produto`: market, news, learn, simulator) in one column on the right under a muted caption, and the standing disclaimers in `secondary-text` captions bottom left. Under the card, one row in the band's on-colour: "© year invest.ao" (`common.appName`; `year` is the request's Luanda year, `civilDate(requestTime())`, passed by the layouts) on the left and the legal links (privacy policy, terms, support) on the right. Focus rings take the band's on-colour and the card's take the accent again. The theme and the language live in the top bar only; sign-in is the top bar's pill; the deletion page is linked from `/suporte`. The footer has no top margin of its own (`mt-auto`): the page's bottom padding is the gap above it.

## Page templates

Pick the template, then read the file it names. Every page also has a `loading.tsx` beside it: the template's route skeleton (see [components.md](components.md#route-skeletons-uicomponentspage-skeleton)), shown inside the kept frame the moment a link to the page is pressed. A new page gets one too, built from the same template. A route group (`(home)`, `mercado/(overview)`, `noticias/(feed)`, `aprender/(index)`) holds a page whose skeleton must not cover the pages under it: the first `loading.tsx` above a page is the one shown.

### 1. Marketing landing — `src/app/[locale]/(site)/(home)/page.tsx`, `src/features/site/home.tsx`, `home-client.tsx`

```
 ╭ HeroPanel: stage-deep, inset, one window tall ──────────────╮
 │ ●                                               ▰           │  decorative shapes and the mark
 │              O teu mercado, de perto.                       │  h1, text-hero, centred
 │              (  Descarregar na App Store  )                 │  one large pill, on-stage-deep fill
 │                                                      ◆      │
 ╰─────────────────────────────────────────────────────────────╯
            O mercado, mais ◆ perto.                 canvas · SectionIntro: text-heading, mark inline
                 (Explorar ↗)                          soft pill to /mercado
          [ search ··························· ]      MarketSearch (GET form, max 576 px)
          24 Instrumentos · 6 Ações · …               CoverageFigures (absent without a catalogue)
 ┌ MarketPreview: flush card ────────────────────┐     max 1024 px; tabs, table of dated closes,
 └───────────────────────────────────────────────┘     the kind's outline "Ver tudo" pill
        Segue o que te ◆ interessa.               SectionIntro + (Acompanhar ↗)
 (◉ Lista)                               (←)(→)      Deck: SectionChip and the buttons
 ┌ brand ──────┐┌ deep ───────┐┌ pale ─────┐┌ ink…     DeckCards: statement on top, visual in a
 │ statement   ││ statement   ││           ││          frame anchored to the bottom; the row runs
 │ ╭ frame ──╮ ││ ╭ frame ──╮ ││           ││          to the window's edge, cards snap
 EXEMPLO ILUSTRATIVO
▓▓ stage-deep band ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓   A tua carteira, com ◆ clareza. (Registar compra ↗) ▓  SectionIntro tone="deep"
▓  (◉ Carteira)                           (←)(→)     ▓  portfolio deck: brand, ink, pale
▓            invest.ao ◆ Plus                         ▓  SectionIntro (no pill)
▓  ┌ stage-pale card ────────────────────────────┐   ▓  benefits (text-lead) and the App Store
▓  │ ✓ ✓ ✓ (App Store)        PlusVisual         │   ▓  pill 5/12, PlusVisual 7/12 from 1024 px
▓▓ stage-brand band ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓        Acompanha a bolsa de Angola num só sítio.    ▓  text-lead
▓             O teu mercado, de ◆ perto.              ▓  h2, text-heading
▓          (  Descarregar na App Store  )             ▓  large pill on the card fill
▓  ╭ footer card ─────────────────────────────────╮   ▓  SiteFooter continues the band
```

The page alternates the canvas and full-bleed stage bands with no gradient between them. The hero is an inset `stage-deep` panel right under the floating top bar, about one window tall, holding only the `h1` and one large App Store pill. Each section opens with a centred `SectionIntro`: a giant `text-heading` title (two lines at most) with the brand mark set inline before its last word, then an optional small soft pill to the section's page; 96 px of air above it (144 px from 768 px) and 48–64 px down to its content. The market section keeps the product closest to the hero: the search, the catalogue's coverage figures and the market preview (dated verified closes, never a current quote). The watchlist deck sits on the canvas; the portfolio deck and Plus share a `stage-deep` band; the close is a `stage-brand` band that the footer continues. Deck cards rotate the fills (brand, deep, pale, ink on the canvas; brand, ink, pale on the deep band) so neighbours never match the band under them. Each deck has one "Exemplo ilustrativo" caption; the Plus visual has its own.

Motion is restrained: the hero's title rises once on load with no fade, the pill fades in after it; below it, each section intro (heading, then pill), the market preview, each deck, the Plus card and the closing band ease in once as they enter the viewport, and the visuals' charts draw from the left. Decks move only when asked (touch, trackpad, Tab or the buttons); no parallax, no auto-play (see [theme.md](theme.md#motion)).

### 2. List / table page — `src/app/[locale]/(market)/mercado/(overview)/page.tsx`, `src/features/market/browse/market-browser.tsx`

```
                Mercado                       h1 centred
┌ card ──────┐ ┌ card ──────┐ ┌ card ──────┐  1 col · 2 from 768 · 3 from 1280, gap-4
│ StatTiles  │ │ StatTiles  │ │ movers     │
└────────────┘ └────────────┘ └────────────┘
 Todos Ações Obrigações …  ▔▔▔▔   [ search ]   NavTabs (filters as links) + SearchField
 12 títulos                         (Sort ▾) ↓  count; sort menu below 768 px
┌ flush table card ───────────────────────────┐
│ Instrumento        Preço    Variação Volume │  TableSortHeader
│ ● Name • SYM     65 000 Kz   +2,1 %   1 234 │
└─────────────────────────────────────────────┘
```

Filters and sort live in the URL, so the list works as plain links and a GET form before JavaScript.

### 3. Detail page with a sticky sidebar — `src/features/market/instrument/instrument-view.tsx`

```
│ ← Mercado            │ Visão geral  Sobre  Ordens        SectionTabs
│ ● Name SYM (h1)      │ ┌ chart card ────────────────┐
│ 65 000 Kz  +2,1 %    │ │ range track · chart        │
│ Último fecho · data  │ └────────────────────────────┘
│ (actions)            │ ┌ card ┐ ┌ card ┐ …
│ key statistics       │
│ market information   │
 19.5 rem, sticky        content column
```

From 1024 px: a `19.5rem | 1fr` grid. The sidebar is `lg:sticky lg:top-(--top-bar-height)`, as tall as the window under the bar (`lg:h-[calc(100dvh-var(--top-bar-height))]`), scrolls on its own (`overflow-y-auto overscroll-contain`) and has a hairline on its right. It holds the identity (the page's `h1`), the price and its validity line, the account actions, `StatStrip variant="grid"` and the market information. Below 1024 px the sidebar is the top block of one column and the market information moves to the end.

### 4. Dashboard with a section rail — `src/app/[locale]/(app)/carteira/layout.tsx`, `src/features/portfolio/portfolio-rail.tsx`, `portfolio-view.tsx`

```
┌──────┐ │ Carteira (h1)                ◉ (Menu) (Partilhar)   title row + actions
│wallet│ │ (+ Registar compra) (CSV) (Simular)               action pills, one primary
├──────┤ │ ┌ value card: headline value, change, range, chart ┐
│ Visão│ │ ┌ positions table card (flush) ────────────────────┐
│Regist│ │ ┌ card ┐ ┌ card ┐                                 two columns from 1280 px
│Rendim│ │ └──────┘ └──────┘
└──────┘
 rail (sticky, 16 px under the bar)
```

`lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8`. `SectionRail` is a vertical rail from 1024 px and a horizontally scrolling strip above the page below it. A `leading` switcher tile (the portfolio menu) sits above the items. The page title row holds the page-level actions.

### 5. Card-grid home — `src/app/[locale]/(app)/inicio/page.tsx`, `src/features/home/home-market.tsx`

```
 Início (h1)                                   ⟳
┌ overview card ──────────────┐ ┌ watchlist ─┐   main column | 20 rem column
│ headline index, sparkline   │ │ CompactRow │
└─────────────────────────────┘ └────────────┘
 context slot                     news, updates, recaps
┌ movers panel ───────────────┐   simulator link card
```

`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start gap-6`. On phones the two columns interleave in iOS order: each column is `contents` below 1024 px and every block has a `max-lg:order-N`.

### 6. Centred reading or settings column — `ReadingPage` in `src/features/site/pages.tsx`, `SignedInPage narrow` in `src/features/shell/placeholder-page.tsx`

```
        Title (h1, PageHeading)
        ┌ card ─────────────────┐   768 px column, gap-6
        │ rows divided by hairlines │
        └───────────────────────┘
```

Legal pages, support, account deletion, invites, lessons, news, settings (`/definicoes` with `SettingsGroup` cards), search.

### 7. Centred message or auth card — `MessagePage` in `src/features/site/pages.tsx`, `src/app/[locale]/(auth)/entrar/page.tsx`

```
            ┌ MessageCard (max 448 px) ┐
            │ Title (h1)               │
            │ one line                 │
            │ (Action)                 │
            └──────────────────────────┘
```

Not found, errors, revoked share links, maintenance, sign-in. The card is centred on the canvas (`flex-1 justify-center`); sign-in has no site chrome.

## Grids and gaps

- Page blocks: `flex flex-col gap-6`. A rail and its page, and the `/mercado` stack from 1024 px: `gap-8`.
- Summary cards: `grid gap-4`, `md:grid-cols-2 xl:grid-cols-3`. A card that must span: `md:col-span-2 xl:col-span-1`.
- Card columns in a dashboard: `grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start`.
- Inside a card: `gap-3` between tiles, `gap-4`/`gap-5` between blocks.
- Grid children that hold text get `min-w-0` (or `minmax(0,1fr)` tracks) so long names truncate instead of widening the page.

## Title placement

- One `h1` per page, in the display role, except where noted.
- List pages: centred above the summary cards (`/mercado`).
- Dashboards, Home, reading columns: left, at the top of the content column. Page-level actions sit on the same row to the right (icon buttons) or in a pill row under it.
- Detail pages: the `h1` is the instrument's name in the sidebar (body size, `desk:text-lg`); the price beneath it is the largest thing on the page.
- Landing: centred in the hero panel (`text-hero`); section titles are centred `SectionIntro` `h2`s (`text-heading`); deck cards' statements are `h3`s.
- Message pages: inside the card.
- Card titles are `h2` through `Card`/`Panel` `title` (the `CardHeader` row: title left, one action right). Headings on the canvas outside a card use `SectionHeader`.

## Tables on phones

Tables never scroll sideways in product pages; columns fold instead.

- The name column always shows; it takes the remaining width (`DataTable className="table-fixed"` with fixed widths on the numeric columns, e.g. price `w-36 sm:w-44`).
- The price column always shows. Change folds below 640 px (`hidden sm:table-cell`) and its badge moves under the price (`PriceCell inlineChange="sm:hidden"`). Volume folds below 768 px (`hidden md:table-cell`).
- Wider tables fold progressively with `max-md:hidden`, `max-lg:hidden`, `max-xl:hidden`; a folded figure that matters moves into the name cell's `detail` line (portfolio positions: the quantity) or under the remaining figure.
- `TableNameCell stackOnPhone` puts the symbol under the name below 640 px.
- Logos give way first on very narrow screens: `max-[22.5rem]:hidden` in the market table, `max-[25rem]:hidden` in `CompactRow`.
- Sorting: from 768 px every header is a `TableSortHeader` link; below it a sort menu and a direction button sit above the table (`/mercado`).
- Row actions sit in the last cell with `relative z-10`, above the row link's overlay (`/lista`).
- Short lists in a narrow column (Home, the movers card) use `CompactRow`, not a table.

## Responsive rules

- 320 px: everything holds. Use `min-w-0`, `truncate`, `break-words`/`[overflow-wrap:anywhere]` for user text, `max-[20rem]:flex-col` where a row must stack (`AssetRow`), and hide decoration before content.
- Horizontal rows of tabs, pills and rail items scroll with a hidden scrollbar (`overflow-x-auto [scrollbar-width:none]`) and bleed to the screen edge with negative margins (`-mx-4 px-4`).
- 200 % zoom: type is in rem and the breakpoints are in rem, so a zoomed 1440 px window gets the 720 px layout. Do not use `px` breakpoints or fixed heights on text containers.
- Targets: at least 44 px (`min-h-11`, `size-11`); icon buttons and fields are 48 px on phones (`size-12`, `min-h-12`); full pills are 56 px on phones (`min-h-14`).

## Sticky rules

- The top bar is the only sticky element on phones (with the fixed bottom tab bar in the app). Its pieces float: content scrolls under the gaps between them, so nothing else may stick at `top-0`. The public bar's menu opens under it and locks the page's scroll while it is open.
- Columns stick from 1024 px only, measured from `--top-bar-height`: flush under the bar with `lg:top-(--top-bar-height)` (the instrument sidebar), 16 px below it with `lg:top-[calc(var(--top-bar-height)+1rem)]` (`SectionRail`) or 32 px below it (the simulator's controls).
- A sticky column that can be taller than the window gets the window's height under the bar and its own scroll: `lg:h-[calc(100dvh-var(--top-bar-height))] lg:overflow-y-auto lg:overscroll-contain`.
- `html` has `scroll-padding-top: var(--top-bar-height)`, so anchors and focused elements scroll clear of the bar.
- Sticky columns (`SectionRail`, the instrument sidebar) sit in their own grid track, so nothing scrolls under them and they need no background. Anything content scrolls under, like the top bar's pieces, is opaque.

## Known gaps

Inconsistencies found while writing these docs, left for a later change:

- **Lead figure size.** Card and sidebar lead figures use arbitrary sizes (`text-[1.75rem]` on the instrument page, `text-[1.625rem] desk:text-[1.5rem]` in `StatTile size="large"`, the landing visuals and miniatures); there is no token between `text-headline` and `text-price`. `StatTile`'s small value uses Tailwind's `text-lg`.
- **Two divider colours.** 23 files still use `border-separator`/`divide-separator` (the iOS separator) where the web system uses `hairline` (37 files). New code uses `hairline`; `separator` stays for the bottom tab bar edge.
- **Small headings in semibold.** A few `h3` row titles at body or secondary size (`portfolio-insights.tsx`, `notification-settings.tsx`, `market-session-sheet.tsx`, the comparison sheet, news markdown) set `font-semibold`, heavier than the 500 heading weight.
- **Page top spacing.** Market pages use `lg:pt-6`; site and signed-in pages use `lg:pt-8`. The instrument page relies on the 24 px (`lg:-mt-6`).
- **Text-link actions.** Some card actions are accent text links or buttons (`Ver detalhes` on the Home overview, recaps, `Tentar novamente` in `SectionPlaceholder`) rather than pills.
- **Two section heading components.** `SectionHeader` (baseline-aligned) and `CardHeader` (44 px row, centred) differ slightly; only one page uses `SectionHeader`.
- **Unused primitives.** `ActionTile`, `MarketMetric`, `SensitiveValue` and `FeatureRow` (in `rows.tsx`) appear only in the gallery.
- **Double padding in the index dialog.** `IndexInfo` (`market-overview.tsx`) adds `px-5` inside the `Dialog` body, which already has `px-5 desk:px-6`, so its content sits 40 px from the edge instead of 20–24 px.
