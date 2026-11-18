# Layout

## Breakpoints

Tailwind's defaults plus one custom variant (`src/app/globals.css`):

| Prefix | From | Used for |
|---|---|---|
| `max-[20rem]:` … `min-[26rem]:` | 320–416 px | Narrow-phone fixes: hide a logo, a wordmark or a column (see [Tables on phones](#tables-on-phones)) |
| `sm:` | 640 px | 24 px gutters, wider table columns, the landing showcase gets its bezel |
| `md:` | 768 px | Two-column landing rows, two summary cards per row, the side sheet, every table header sorts |
| `lg:` | 1024 px | **Page layout**: top-bar navigation, no bottom tab bar, sidebars, rails, sticky columns, `Panel` becomes a card |
| `xl:` | 1280 px | Three summary cards on `/mercado`, two card columns on the portfolio dashboard, the widest table columns |
| `desk:` | 1024 px **and** `pointer: fine` | **Web scale**: type, radii, pill and field heights, card padding |

### `lg:` vs `desk:`

- `lg:` is about **space**: it moves things (columns, rails, navigation). It applies to any device 1024 px wide, touch or not.
- `desk:` is about **density**: it shrinks things (36 px price, 16 px body, 44 px pills, 22 px card corners, 24 px card padding). A touch screen never gets it, so touch targets keep iOS sizes on a large tablet.
- Layout goes on `lg:`; sizes, radii and padding go on `desk:`. `Card` becomes the web card on `desk:`; `Panel` becomes a card on `lg:` (it is a layout decision: on phones a `Panel` is a plain section).

## The page column

```ts
PAGE_CONTAINER = "mx-auto w-full max-w-300 px-4 sm:px-6"   // 1200 px max, 16 / 24 px gutters
READING_COLUMN = "mx-auto flex w-full max-w-3xl flex-col"   // 768 px, inside the container
SITE_PAGE      = PAGE_CONTAINER + "pt-4 pb-16 lg:pt-8"       // src/features/site/pages.tsx
SIGNED_IN_PAGE = PAGE_CONTAINER + "pt-4 pb-16 lg:pt-8"       // src/features/shell/placeholder-page.tsx
```

Every page's `<main id="main">` uses one of these. Market pages get theirs from `src/app/[locale]/(market)/mercado/layout.tsx` (`pt-4 pb-16 lg:pt-6`). The top bar and the footer run full width; their content uses the same gutters.

## Chrome

### Top bar (`TopBar`, `src/ui/components/top-bar.tsx`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◆ invest.ao   (Mercado) Notícias Aprender          [ search ]   ◐ ⚙ (Entrar) │  64 px, sticky, z-30
└──────────────────────────────────────────────────────────────────────────┘
```

One bar for the site and the app: full width, 64 px, `sticky top-0 z-30`, `bg-elevated-background shadow-bar`. Logo, pill navigation (the current section is the grey `action-surface` pill with `aria-current`), then search and actions on the right.

| Mode | Who | Below 1024 px | From 1024 px |
|---|---|---|---|
| `mobileNav="row"` | Public site (`SiteHeader` in `src/features/site/chrome.tsx`) | The pills take a horizontally scrollable row under the logo row | Pills beside the logo |
| `mobileNav="none"` | Signed-in app (`ShellTopBar` in `src/features/shell/shell-nav.tsx`) | No pills; the bottom tab bar has the tabs | Pills beside the logo; the search tab becomes the palette field |

Site actions: language, `ThemeMenu`, the compact "Iniciar sessão" pill (links to `/entrar`). App actions: unusual activity and activity (plain icon links with `aria-current`, an unread dot), the profile initials. The wordmark hides below 400 px (the link keeps its name).

### Bottom tab bar (`ShellNav`)

Signed-in app only, below 1024 px: `fixed inset-x-0 bottom-0 z-20`, five tabs in iOS order (Início · Explorar · Carteira · Lista · Pesquisa, `TABS` in `destinations.ts`), icon over an 11 px label, the current one in `accent` with `aria-current="page"`, safe-area padding. The app shell adds `pb-20 lg:pb-0` so content clears it.

### Footer (`SiteFooter`)

Public pages only (the app has none): a hairline, the logo and three link columns (two per row on phones, `2fr + 3 × 1fr` from 768 px), the standing disclaimers as captions, then `ThemeSwitch` and the language link.

## Page templates

Pick the template, then read the file it names.

### 1. Marketing landing — `src/app/[locale]/(site)/page.tsx`, `src/features/site/home.tsx`

```
  ░ glow + fine grid ░                  HeroBackdrop, behind the hero and the showcase
      Title (centred, 36 → 68 px)       HERO_TITLE, fluid
          subtitle (≤ 576 px)
        [ search ············ ]
     (Entrar)  (Descarregar)
  164 Instrumentos · 8 Ações · …        HeroFigures: catalogue counts, absent without a catalogue
   ░ halo ░
 ╭ bezel ─────────────────────────╮     Showcase (max 1024 px; bezel from 640 px)
 │┌ panel ───────────────────────┐│     MarketPreview: one flush card
 ││ Ações Obrigações … ▔▔▔        ││       SectionTabs on top
 ││ table                        ││       table of dated verified closes
 ││          (Ver tudo)          ││       the kind's outline pill in the footer
 │└──────────────────────────────┘│
 ╰────────────────────────────────╯
─────────────────────────────────────
   Section title (centred)
 facts list        │  diagram
─────────────────────────────────────
 visual stage │ icon, title, line, (pill)   FeatureRow, alternating with `flip`
 ...
 ┌ panel: Plus ───────────────────┐
 ┌ panel: closing band ───────────┐
```

The hero and the market preview share one backdrop, so the table rises out of the hero: its tab row is above the fold at 1440 × 900, and on phones the title, subtitle, search and both pills fit the first screen. Sections below sit on the canvas with `HOME_SECTION` spacing, centred `HOME_HEADING` titles. Cards (`panel`) hold the table, the visuals, Plus and the closing band. Prices are the server's dated verified closes; the figures are the catalogue's visible counts.

### 2. List / table page — `src/app/[locale]/(market)/mercado/page.tsx`, `src/features/market/browse/market-browser.tsx`

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

From 1024 px: a `19.5rem | 1fr` grid. The sidebar is `lg:sticky lg:top-16`, as tall as the window (`lg:h-[calc(100dvh-4rem)]`), scrolls on its own (`overflow-y-auto overscroll-contain`) and has a hairline on its right. It holds the identity (the page's `h1`), the price and its validity line, the account actions, `StatStrip variant="grid"` and the market information. Below 1024 px the sidebar is the top block of one column and the market information moves to the end.

### 4. Dashboard with a section rail — `src/app/[locale]/(app)/carteira/layout.tsx`, `src/features/portfolio/portfolio-rail.tsx`, `portfolio-view.tsx`

```
┌──────┐ │ Carteira (h1)                ◉ (Menu) (Partilhar)   title row + actions
│wallet│ │ (+ Registar compra) (CSV) (Simular)               action pills, one primary
├──────┤ │ ┌ value card: headline value, change, range, chart ┐
│ Visão│ │ ┌ positions table card (flush) ────────────────────┐
│Regist│ │ ┌ card ┐ ┌ card ┐                                 two columns from 1280 px
│Rendim│ │ └──────┘ └──────┘
└──────┘
 rail (sticky, lg:top-20)
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
- Landing: centred in the hero; section titles are centred `HOME_HEADING` `h2`s.
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

- The top bar is the only sticky element on phones (with the fixed bottom tab bar in the app).
- Columns stick from 1024 px only: flush under the bar with `lg:top-16` (the instrument sidebar), or 16 px below it with `lg:top-20` (`SectionRail`).
- A sticky column that can be taller than the window gets a window height and its own scroll: `lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:overscroll-contain`.
- Sticky columns (`SectionRail`, the instrument sidebar) sit in their own grid track, so nothing scrolls under them and they need no background. Anything content scrolls under, like the top bar, is opaque.

## Known gaps

Inconsistencies found while writing these docs, left for a later change:

- **Lead figure size.** Card and sidebar lead figures use arbitrary sizes (`text-[1.75rem]` on the instrument page, `text-[1.625rem] desk:text-[1.5rem]` in `StatTile size="large"`, the landing visuals); there is no token between `text-headline` and `text-price`. `StatTile`'s small value uses Tailwind's `text-lg`.
- **Two divider colours.** 23 files still use `border-separator`/`divide-separator` (the iOS separator) where the web system uses `hairline` (37 files). New code uses `hairline`; `separator` stays for the bottom tab bar edge.
- **Surfaces that are not cards.** A few blocks use `bg-elevated-background` with large corners instead of `Card` or `panel`: the listing link on `/inicio`, the context slot (`home-context-slot.tsx`), the index methodology boxes in `IndexInfo` (`market-overview.tsx`). On desk they have no border or shadow, unlike the cards around them.
- **Page top spacing.** Market pages use `lg:pt-6`; site and signed-in pages use `lg:pt-8`. The instrument page relies on the 24 px (`lg:-mt-6`).
- **Text-link actions.** Some card actions are accent text links or buttons (`Ver detalhes` on the Home overview, recaps, `Tentar novamente` in `SectionPlaceholder`) rather than pills.
- **Two section heading components.** `SectionHeader` (baseline-aligned) and `CardHeader` (44 px row, centred) differ slightly; only one page uses `SectionHeader`.
- **Unused primitives.** `ActionTile`, `MarketMetric`, `SensitiveValue` and `FeatureRow` (in `rows.tsx`) appear only in the gallery.
- **Double padding in the index dialog.** `IndexInfo` (`market-overview.tsx`) adds `px-5` inside the `Dialog` body, which already has `px-5 desk:px-6`, so its content sits 40 px from the edge instead of 20–24 px.
