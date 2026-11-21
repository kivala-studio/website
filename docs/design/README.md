# Web design system

The invest.ao website's visual language, layout rules and component library. Everything here is read from the code; when the code and these pages disagree, the code wins and these pages get fixed in the same PR.

| Page | What it covers |
|---|---|
| [theme.md](theme.md) | Colour tokens (canvas, cards, stage fills), type scale (product and marketing roles), radii, elevation, spacing, motion (the one reference for animation), dark mode, increased contrast, theme switching |
| [layout.md](layout.md) | Breakpoints, `lg:` vs `desk:`, the page column, the floating top bar, tab bar, footer band, page templates (the landing included), tables on phones, sticky and responsive rules |
| [components.md](components.md) | Every shared component: when to use it, props, a minimal example, accessibility, do and don't |
| [patterns.md](patterns.md) | Prices, numbers, privacy mode, states, copy, focus, illustrative visuals, icons, "see all", page actions |

The live library is `/dev/design` (`src/features/design-gallery/`), built only outside `production` data mode. It shows every component below in its variants and states, in the current theme, at the current width.

## Where it lives

| Layer | Files |
|---|---|
| Tokens | `src/ui/theme/tokens.css` (colours, stage fills, shadows), `src/app/globals.css` (type and marketing roles, radii, `--top-bar-height`, `desk:`, `panel`, focus ring), `src/ui/theme/motion.css` (durations, curves, motion patterns, the top bar's lift) |
| Motion hooks | `src/ui/motion/*` |
| Primitives | `src/ui/components/*`, `src/ui/icons/*` |
| Shell | `src/features/shell/*` (signed-in app), `src/features/site/chrome.tsx` (public site: header, footer band) |
| Landing | `src/features/site/home.tsx` (stages, intros, hero panel, deck cards), `src/features/site/home-client.tsx` (deck, market search and preview), `src/features/site/visuals.tsx` |
| Shared feature pieces | `src/features/market/browse/price-cell.tsx`, `src/features/market/browse/market-overview.tsx` (`CompactRow`, `MoverRow`), `src/features/settings/settings-ui.tsx`, `src/features/privacy/privacy-mode.tsx`, `src/features/portfolio/portfolio-ui.tsx` (`Private`, `toneOf`) |

## Principles

1. **Financial values are the hero.** Prices, portfolio values and changes get the display face, the largest sizes, the semibold weight and the most space. Labels are small and muted. Nothing decorative competes with a number.
2. **A tinted canvas and flat cards.** The page is one flat canvas with a faint accent tint (`canvas`). Content is grouped on flat cards (`Card`, `Panel`, the `panel` utility): the card fill alone sets them apart (white in light, a lighter fill in dark), with no border and no shadow; the edge appears only with increased contrast (`panel-edge`). Inside a card, nested tiles take the canvas fill. Only floating surfaces (menus, dialogs, toasts, the top bar once the page scrolls) keep a faint edge and a soft shadow.
3. **Stage fills for big moments.** Full-bleed bands and solid cards on the landing and the footer use the stage fills (`stage-brand`, `stage-deep`, `stage-ink`, `stage-pale`), each with its on-colour for text and focus rings. Product pages stay on the canvas.
4. **Pills.** Buttons, top-bar links, chips, section chips and the "Ver tudo" link are fully rounded. One primary (solid accent) pill per view; the rest are secondary (the soft accent tint) or outline. Hero calls to action use the large pill.
5. **Two faces, light headings.** Outfit (`font-display`) for headings, financial values, table cells, stat values and navigation; Inter (`font-sans`, the default) for body copy, buttons, fields and table headers. Headings are weight 500 with tight tracking; the landing's marketing roles (`text-hero`, `text-heading`, `text-statement`, `text-lead`) are 400. Values stay semibold. Every number uses tabular figures.
6. **Our accent and our blues.** `accent` (#1854c5 light, #5a9bff dark) marks the primary action, the current section, links, focus and selected icons; the stage fills are the brand blues and ink. Green and red are for changes only.
7. **Light and dark are first-class.** Every token has both values; every screen is checked in both.
8. **Phones keep iOS proportions.** Below 1024 px and on touch screens of any width the iOS sizes apply (56 px pills, 17 px body, 48 px icon buttons). Below 1024 px the signed-in app also has the bottom tab bar. The web scale (36 px price, 16 px body, 44 px pills, tighter padding) applies on `desk:` only: at least 1024 px wide with a mouse or trackpad.
9. **No taglines, helper text or secondary labels.** If a screen needs them to make sense, the layout is wrong (AGENTS.md, important rule 1 and standing rule 11).

## Using these docs

- Building UI: find the component in [components.md](components.md) before writing classes. Open `/dev/design` to see it in both themes.
- Choosing a page structure: pick the template in [layout.md](layout.md) and open the file it names.
- Showing a price, an amount or a personal figure: read [patterns.md](patterns.md) first.
- Adding a token or a primitive: add it to the code, to the right page here and to the gallery in the same PR.

## Building a new page

1. Pick the template ([layout.md](layout.md#page-templates)) and wrap the page in `<main id="main">` with `SITE_PAGE` (public) or `SIGNED_IN_PAGE` (signed in). Market pages get their `<main>` from `mercado/layout.tsx`.
2. One `h1` per page, placed as the template says. Card titles are `h2` through `Card`/`Panel` `title`.
3. Group content in `Card` or `Panel`. Tables go in a flush card; row lists in a `Panel` or a titled `Card`.
4. Use the primitives: buttons from `buttons.tsx`/`button-styles.ts`, fields from `field-styles.ts`, tabs from `controls.tsx`, tables from `table.tsx`, states from `states.tsx`.
5. Colours from tokens only (`bg-canvas`, `bg-card-background`, `text-secondary-text`, `border-hairline`…). No hex values, no Tailwind palette colours (`gray-200`, `blue-600`).
6. Prices through `PriceCell`/`rowFigure` or the instrument page's validity logic; amounts as `Decimal` through `useFormat()`; personal figures through `Private` or `HiddenValue`.
7. Every string from the message catalogue (`t("…")`); web-only strings in the `site` namespace. Client components need their keys shipped (`CLIENT_NAMESPACES` or `AREA_KEYS` in `src/i18n/client-messages.ts`).
8. Loading, empty, error and stale states for every data block.
9. Every state change animates with a pattern from [theme.md](theme.md#motion), with its reduced-motion fallback.
10. Check at 320, 375, 768 and 1440 px, light and dark, `pt` and `en`, keyboard only and at 200 % zoom. Targets ≥ 44 px; buttons and links show the focus ring, fields the accent border and glow.
