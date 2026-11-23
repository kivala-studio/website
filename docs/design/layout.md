# Layout

## Breakpoints

| Name | Condition | Effect |
|---|---|---|
| `sm:` | 640 px | Page gutter 24 px (16 px below) |
| `md:` | 768 px | Two-column card grids; more section spacing on the landing page |
| `lg:` | 1024 px | Page layout switches: the app sidebar replaces the top bar and tab bar; the public header shows its sections inline |
| `desk:` | 1024 px and a fine pointer | The web type scale, smaller radii, 44 px controls ([theme.md](theme.md)) |
| `xl:` | 1280 px | Three-column card grid on `/mercado` |

Touch screens keep the larger sizes at every width (`src/app/globals.css`).

## Page variables

Defined on `:root` in `src/app/globals.css`:

| Variable | Default | From 1024 px | In the app shell from 1024 px |
|---|---|---|---|
| `--top-bar-height` | 4rem | 5.5rem | 0rem |
| `--page-width` | 75rem | 75rem | 100rem |
| `--page-gutter` | 1.5rem | 1.5rem | 2rem |
| `--reading-start` | auto | auto | 0 |

The app-shell values apply when the page contains `[data-shell="app"]`. `html` has `scroll-padding-top: var(--top-bar-height)`.

## Containers

| Constant | Definition | Use |
|---|---|---|
| `PAGE_CONTAINER` | `max-w-(--page-width)`, centred, gutters 16 px, 24 px from 640 px, `--page-gutter` from 1024 px | Every page column (`src/ui/components/layout.tsx`) |
| `READING_COLUMN` | `max-w-3xl` (768 px), centred on the site, on the left edge in the app | Lists, settings, articles, legal text |
| `SITE_PAGE` | `PAGE_CONTAINER` with `pt-4 pb-16 lg:pt-8` | A public page's `<main>` (`src/features/site/pages.tsx`) |
| `SIGNED_IN_PAGE` | Same spacing | A signed-in page's `<main>` (`src/features/shell/route-skeletons.tsx`) |
| `MARKET_PAGE` | `PAGE_CONTAINER` with `pt-4 pb-16 lg:pt-6` | `/mercado` and below |
| `PORTFOLIO_PAGE` | `SIGNED_IN_PAGE` as a column, a two-column grid from 1024 px | The portfolio area with its rail |

Each page renders its own `<main id="main">`.

## Public frame

`SiteFrame` (`src/features/site/site-frame.tsx`): `SiteHeader`, the page, `SiteFooter`.

- Header (`src/features/site/chrome.tsx`, `src/ui/components/top-bar.tsx`): the logo, the sections in a centred capsule, then the language, the theme and the account pill (sign in, or the dashboard link when signed in). Below 1024 px the sections, theme and language move into a menu. The header has no search.
- The top bar is sticky; its pieces gain a shadow once the page scrolls under them (`top-bar-float`).
- Footer: a `stage-brand` band containing one card with the mark, the copyright year (the Luanda year from the server) and the legal and product link columns.
- `plus={false}` removes Plus from the header and footer on `(store-linked)` pages.

## Landing page

`src/app/[locale]/(site)/(home)/page.tsx`:

1. Hero panel on `stage-deep`: the `h1` and the App Store pill.
2. On the canvas: the market section (search form, coverage figures, a market preview table per kind) and the "follow" deck of cards.
3. On a `stage-deep` band: the portfolio deck and the Plus section (a `stage-pale` card).
4. On `stage-brand`: the closing line and the App Store pill; the footer continues the band.

Sections below the hero are revealed once as they enter the viewport (`data-reveal`, `Reveal`); the server markup is the end state, so the page reads the same without JavaScript. Market rows are dated verified closes from the cached catalogue.

## App shell

`AppShell` (`src/features/shell/app-shell.tsx`), `src/features/shell/shell-nav.tsx`:

- From 1024 px: a sticky sidebar card (width 15rem) with the logo, the search field, the tabs, unusual activity, the activity inbox (a dot when something is unread) and the profile. The page spans the rest of the window up to `--page-width`.
- Below 1024 px: a top bar (logo, search button, unusual activity, the bell, the profile initials) and a fixed bottom tab bar of five tabs.
- Tabs: Início (`/inicio`), Explorar (`/mercado`), Carteira (`/carteira`), Lista (`/lista`), Pesquisa (`/pesquisa`) (`src/features/shell/destinations.ts`). From 1024 px the search tab is replaced by the search field.
- The current item is marked `aria-current="page"` and its fill glides to the pressed item at once, while the page is still loading (`useDestinationPathname` in `src/i18n/link.tsx`, `useSlidingIndicator`).

## Loading states

- 25 route segments have a `loading.tsx` that renders a skeleton of the page's shape (`src/features/shell/route-skeletons.tsx`, `src/ui/components/page-skeleton.tsx`).
- Layouts that must answer with a real 404 or redirect resolve their parameter above the `loading.tsx` (instrument, listing, lesson, article layouts).
- `PendingPage` and the app's `Link` keep the pressed link in its pressed state until the new page or its skeleton is shown (`src/features/shell/pending-page.tsx`, `src/i18n/link.tsx`).

## Reading pages

`ReadingPage` (`src/features/site/pages.tsx`): the 768 px column with the title and cards. Used by legal, support, deletion, invite and lesson pages and the shared portfolio.

## Instrument page

From 1024 px: a sticky side column with the identity (`h1`), the price and its validity line, the account actions, key statistics and market information, beside a content column with the tabs and their cards. Below 1024 px: one column with the side column's content on top (`src/features/market/instrument/instrument-view.tsx`).
