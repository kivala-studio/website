# Layout

## Breakpoints

Tailwind's defaults plus one custom variant (`src/app/globals.css`):

| Prefix | From | Used for |
|---|---|---|
| `max-[20rem]:` … `min-[26rem]:` | 320–416 px | Narrow-phone fixes: hide a logo, a wordmark or a column (see [Tables on phones](#tables-on-phones)) |
| `sm:` | 640 px | 24 px gutters, wider table columns, the landing showcase gets its bezel |
| `md:` | 768 px | Two summary cards per row, the side sheet, every table header sorts |
| `lg:` | 1024 px | **Page layout**: top-bar navigation, no bottom tab bar, sidebars, rails, sticky columns, `Panel` becomes a card, two-column landing feature rows |
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

Public site below 1024 px, menu open:
┌──────────────────────────────────┐
│ ✕ ◆ invest.ao   (Iniciar sessão) │  the bar: one 64 px row; ☰ (✕ while open) leads
├──────────────────────────────────┤  hairline
│ (Mercado                       ) │  48 px font-display rows, current one on the grey pill
│  Notícias                        │
│  Aprender                        │
│ ──────────────────────────────── │  hairline
│ (Sistema|Claro|Escuro)      (EN) │  SiteControls
└──────────────────────────────────┘
░░░░░░░ page dimmed (black/40) ░░░░░░
```

One bar for the site and the app: full width, 64 px, `sticky top-0 z-30`, `bg-elevated-background shadow-bar`. Logo, pill navigation (the current section is the grey `action-surface` pill with `aria-current`), then search and actions on the right.

| Mode | Who | Below 1024 px | From 1024 px |
|---|---|---|---|
| `mobileNav="menu"` | Public site (`SiteHeader` in `src/features/site/chrome.tsx`) | One row: the menu button, the logo, then the sign-in pill at the end. The menu holds the sections, then `menu.content` (theme and language) | Pills beside the logo; `wideActions` before `actions`; no menu button |
| `mobileNav="none"` | Signed-in app (`ShellTopBar` in `src/features/shell/shell-nav.tsx`) | No pills; the bottom tab bar has the tabs | Pills beside the logo; the search tab becomes the palette field |

Site actions: from 1024 px the language (`LanguageFlag` and code), `ThemeMenu` and the compact "Iniciar sessão" pill (links to `/entrar`); below 1024 px only the pill stays in the bar, drawn smaller (36 px, 12 px padding, `SIGN_IN_PILL`; the target stays 44 px) so it doesn't outweigh the logo, and the theme (`ThemeSwitch`) and language sit in the menu as `SiteControls`. App actions: unusual activity and activity (plain icon links with `aria-current`, an unread dot), the profile initials. The wordmark shows from 360 px in the public bar and from 400 px in the app's (the link keeps its name).

The menu is a disclosure, not a WAI-ARIA menu: a 48 px icon button (`menu`, `close` while open) with `aria-expanded` and `aria-controls` that leads the bar, its glyph on the gutter (the button overhangs it by 16 px), then a panel that follows it in the DOM, so Tab goes from the button into the panel. The panel that drops from under the bar (`motion-drop-in`, full width, the bar's gutters, scrolls on its own if the window is short) over the dimmed page (`motion-dim-in`). While it is open the page doesn't scroll. Escape or a tap on the dimmed page closes it and returns focus to the button; following a link, tapping elsewhere on the bar, tabbing out of the menu (on to the logo, say) or widening the window past 1024 px closes it too. Without JavaScript the footer carries the same section links.

### Bottom tab bar (`ShellNav`)

Signed-in app only, below 1024 px: `fixed inset-x-0 bottom-0 z-20`, five tabs in iOS order (Início · Explorar · Carteira · Lista · Pesquisa, `TABS` in `destinations.ts`), icon over an 11 px label, the current one in `accent` with `aria-current="page"`, safe-area padding. The app shell adds `pb-20 lg:pb-0` so content clears it.

### Footer (`SiteFooter`)

```
──────────────────────────────────────────────────────────────── hairline
◆ invest.ao                               Produto      Legal         one 44 px row (36 on desk)
                                          Mercado      Política …
                                          …            …
──────────────────────────────────────────────────────────────── hairline
disclaimers (captions, tertiary, ≤ 672 px)
© 2026 invest.ao
```

Public pages only (the app has none). `SiteFooter({ year })`: under a hairline, the home link (mark and wordmark) and the `nav` of two link columns (Produto, Legal) on one grid of equal tracks; the logo row and the column headings share one height, so the columns start on the logo's line. From 1024 px the logo takes 3 of 5 tracks and the columns the last two; from 640 px the logo and the two columns are three equal tracks; on phones the logo sits above the two columns. The theme and the language live in the top bar only; sign-in is the top bar's pill; the deletion page is linked from `/suporte`. Then, under a second hairline, the standing disclaimers in `tertiary-text` captions and "© year invest.ao" (`common.appName`; `year` is the request's Luanda year, `civilDate(requestTime())`, passed by the layouts). The footer has no top margin of its own: the page's bottom padding is the gap above it.

## Page templates

Pick the template, then read the file it names.

### 1. Marketing landing — `src/app/[locale]/(site)/page.tsx`, `src/features/site/home.tsx`

```
  ░ glow + fine grid ░                  HeroBackdrop, behind the hero and the showcase
      Title (centred, 38 → 68 px)       HERO_TITLE, fluid
          subtitle (≤ 576 px)
        [ search ············ ]
     (Entrar)  (Descarregar)            phones: (Descarregar) alone, as the primary pill
  164 Instrumentos · 8 Ações · …        HeroFigures: catalogue counts, absent without a catalogue;
                                          phones: the kinds as a stat row (8 │ 4 │ 17 │ 131)
   ░ halo ░
 ╭ bezel ─────────────────────────╮     Showcase (max 1024 px; bezel from 640 px)
 │┌ panel ───────────────────────┐│     MarketPreview: one flush card
 ││ Ações Obrigações … ▔▔▔        ││       SectionTabs on top
 ││ table                        ││       table of dated verified closes
 ││          (Ver tudo)          ││       the kind's outline pill in the footer
 │└──────────────────────────────┘│
 ╰────────────────────────────────╯
   Section title (centred)
┌ Simular ──────────── ›┐┌ Ativid. ›┐  Bento: BentoCard links, 6 columns from 1024 px
│╭──────────────────────││╭────────╮│    (4 + 2, then 2 + 2 + 2), 2 at 768 px, 1 on phones;
││ miniature ░ fade ░   │││ mini ░ ││    title, then a miniature that bleeds off the
┌ Notícias ›┐┌ Aprender ›┐┌ Semana ›┐    bottom (and right, `bleed="corner"`) under a fade
│╭─────────╮││╭─────────╮││╭───────╮│
       EXEMPLO ILUSTRATIVO              one caption for the grid
 ░ stage ░──────────╮  ▣              FeatureRows: 6rem apart (4rem on phones)
 │┌ main card ─────┐ │  Title           FeatureRow: visual 7/12 from 1024 px,
 ││ value, chart ● │ │  message         alternating with `flip`; stacked below,
 │└────┌ float ────┴┐│  (pill)          text first
 │     └────────────┘│
 ╰───────────────────╯
   EXEMPLO ILUSTRATIVO
 ...
 ┌ panel: Plus (accent edge, wash) ──────────────┐
 │ invest.ao Plus     ┌ notice ──────┐           │  the Plus panel: text 5/12, PlusVisual 7/12
 │ ✓ ✓ ✓              └┌ Comparar ─────────────┐ │  from 1024 px; stacked below
 │ (App Store)         │ range · two lines     │ │
 │                     │ BAI ━ +12 % · BFA ━ … │ │
 ╰────────────────────────────────────────────────╯
              ▣                          closing line on the canvas (no card):
     O teu mercado, de perto.            CLOSING_TITLE, the app mark tile, two pills
      (App Store) (Iniciar sessão)
  ░ grid + glow, rising from below ░     HeroBackdrop edge="bottom"
──────────────────────────────────────── footer hairline
```

The hero and the market preview share one backdrop, so the table rises out of the hero: its tab row is above the fold at 1440 × 900 and on phones. Below 640 px the hero is three groups with room between them: the title (two lines, 42 px at 390) and subtitle 16 px apart; 32 px below, the search and one pill 12 px apart, the App Store pill as the primary (the top bar already has "Iniciar sessão", so the hero's own is `display: none` there, and the App Store pill's secondary twin likewise); 40 px below, the figures as an even stat row of the kinds without the total; then 48 px to the showcase, with 48 px above the title. From 640 px the hero is unchanged: both pills side by side (sign-in primary, App Store secondary) and the figures as an inline strip with the total. Sections below sit on the canvas with `HOME_SECTION` spacing, centred `HOME_HEADING` titles. The bento follows the showcase directly, with no rule between them, and shows the areas the feature rows do not (simulator, unusual activity, news, lessons, week ahead). Cards (`panel`) hold the table, the bento, the visuals and Plus. The three feature rows sit in `FeatureRows`, which keeps one gap between rows and the same space against the bento and Plus (64 px on phones, 96 px from 768 px). Each row puts the icon squircle, heading, message and pill beside the visual from 1024 px (visual 7 of 12 columns, text vertically centred) and stacks them, text first, below; the visual's floating card leans out towards the text. Plus is the page's one premium moment: a `panel` with an `accent` edge at 25 %, the `bento-wash` light from its top right and a faint accent line along its top, holding the heading, the three benefits, the App Store pill and `PlusVisual`. The page then closes the way it opens: Plus and the closing line share one block over `HeroBackdrop edge="bottom"`, the hero's glow and grid mirrored so the light rises onto the footer's hairline; the closing line is the hero's own (`common.yourMarketUpClose`) in `CLOSING_TITLE`, under the app mark in an accent tile, with the App Store and sign-in pills (the outline pill gets a card fill so it holds on the glow). Gaps stay 64 px on phones and 96 px from 768 px down to the footer. Prices are the server's dated verified closes; the figures are the catalogue's visible counts.

Motion is restrained: the hero comes in once on load (the title rises with no fade, then the subtitle, search and pills, figures and showcase fade and rise, 70 ms apart, done by about 0.85 s); below it, the bento heading and cards, each feature row (text, then visual), the Plus panel and the closing band ease in once as they enter the viewport, and the feature charts draw from the left. No parallax, no scroll-linked effects, nothing hidden without JavaScript or with reduced motion (see [theme.md](theme.md#motion)).

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

- The top bar is the only sticky element on phones (with the fixed bottom tab bar in the app). The public bar's menu opens under it and locks the page's scroll while it is open.
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
