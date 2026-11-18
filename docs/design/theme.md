# Theme

Tokens are CSS custom properties on `:root`, exposed to Tailwind through `@theme`. Use the Tailwind names (`bg-card-background`, `text-secondary-text`, `border-hairline`, `shadow-panel`, `rounded-card`); read the variable directly (`var(--accent)`) only inside arbitrary values such as gradients. Never write a hex value or a Tailwind palette colour in a component.

Sources: `src/ui/theme/tokens.css`, `src/app/globals.css`, `src/ui/theme/motion.css`.

## Colour

Every colour token generates the usual utilities (`bg-`, `text-`, `border-`, `fill-`, `stroke-`, `ring-`, `divide-`), with opacity modifiers where a tint is needed (`bg-positive/12`, `bg-accent/10`).

### iOS semantic colours

Transcribed from iOS `SemanticColors.swift`; `src/ui/theme/tokens.test.ts` keeps them equal to iOS. Do not change these values on the web.

| Token | Light | Dark | Increased contrast (light) | Use |
|---|---|---|---|---|
| `app-background` | `#f2f3f5` | `#090b0f` | | The canvas: `html` background, the bottom tab bar, inset notices inside a card |
| `elevated-background` | `#ffffff` | `#12151b` | | The top bar; `Card surface="elevated"` |
| `card-background` | `#ffffff` | `#171b22` | | Cards, dialogs, menus, toasts, fields |
| `primary-text` | `#182231` | `#f5f7fa` | | Titles, values, row names, body copy on cards |
| `secondary-text` | `#485364` | `#a6afbd` | `#283445` | Labels, supporting lines, table headers, idle tabs |
| `tertiary-text` | `#596579` | `#747e8e` | `#3b4759` | Counts, the "—" of a missing value, trailing chevrons |
| `accent` | `#1854c5` | `#5a9bff` | | Primary pill, links, current tab underline, current rail icon, focus ring |
| `on-accent` | `#ffffff` | `#090b0f` | | Text and icons on an accent, positive, negative or warning fill |
| `positive` | `#08704c` | `#35c98b` | | Upward change |
| `negative` | `#b9233d` | `#ff6677` | | Downward change, destructive actions |
| `warning` | `#845000` | `#f5b544` | | Stale or partial data, attention notices, the offline icon |
| `separator` | `#c5cdd8` | `#2a303a` | `#778396` | iOS separators: the bottom tab bar edge and older dividers (prefer `hairline` on the web) |
| `chart-grid` | `#cbd2dc` | `#252b34` | `#778396` | Chart grid lines |
| `card-outline` | `#c9d0db` | `#2a303a` | `#778396` | The phone card's outline, drawn only when `--card-outline-width` is 1 px |
| `control-outline` | `#778396` | `#2a303a` | | The phone secondary pill and action tiles, drawn at `--control-outline-width` |
| `selected-tab-background` | `#e2eafa` | `#303238` | | iOS selected tab fill (gallery only today) |
| `widget-background` | `#f2f3f5` | `#090b0f` | | iOS widget background (gallery only today) |
| `action-surface` | `#e5e9ef` | `#171e2b` | | Secondary pill, filled icon button, the current top-bar pill, hover fill of plain controls, skeletons |
| `accent-soft` | `#e2eafa` | `#192d4b` | | Selected chip, icon discs, the profile initials, the landing glow |
| `comparison-orange` | `#a34e00` | `#ff9400` | | The movements category tint in the activity centre |
| `comparison-purple` | `#7935b5` | `#ad52e0` | | The portfolio category tint in the activity centre |

| Width token | Light | Dark | Increased contrast |
|---|---|---|---|
| `--card-outline-width` | `0px` | `0px` | `1px` (both themes) |
| `--control-outline-width` | `1px` | `0px` | unchanged |

`brand-violet` (`#6e4fd6`, both themes) has no iOS semantic counterpart: the `violet` monogram of `SecurityLogo` (bonds), the bond tint in search and the second series of the comparison chart.

### Web-only tokens

No iOS counterpart. They draw the web card system.

| Token | Tailwind | Light | Dark | Increased contrast (light) | Use |
|---|---|---|---|---|---|
| `--hairline` | `hairline` | `#e6e9ee` | `#232933` | `#778396` | Row and table dividers, card header rules, tab-row baselines, `StatTile` boxes |
| `--card-border` | `card-border` | `rgb(24 34 49 / 0.07)` | `#232933` | `#778396` | Card, dialog, menu and toast edges |
| `--field-border` | `field-border` | `#dfe3e9` | `#2a303a` | `#778396` | Text and search fields, outline pills, chips, outline icon buttons |
| `--track` | `track` | `#eceff3` | `#0f1217` | | Segmented-control groove, the off switch, hover of grey fills |
| `--raised` | `raised` | `#ffffff` | `#262c36` | | The selected segment, the current rail tile |
| `--panel-shadow` | `shadow-panel` | `0 1px 2px rgb(0 0 0 / 0.04), 0 8px 28px -12px rgb(0 0 0 / 0.08)` | `none` | | Cards, menus, dialogs |
| `--raised-shadow` | `shadow-raised` | `0 1px 2px rgb(24 34 49 / 0.1), 0 1px 1px rgb(24 34 49 / 0.04)` | `none` | | With `bg-raised` |
| `--bar-shadow` | `shadow-bar` | `0 1px 0 rgb(24 34 49 / 0.08)` | `0 1px 0 #232933` | | The top bar's bottom edge |
| `--focus-glow` | `shadow-focus` | `0 0 0 3px` accent at 18 % | accent at 30 % | accent at 45 % | A focused text field |
| `--hero-glow` | `hero-glow`, `showcase-halo` | accent at 11 % | accent at 22 % | | Peak of the landing's accent light. The two utilities (`globals.css`) are radial gradients with eased stops that end transparent inside their box; `hero-grid` is the fine grid that fades out before the edges |

### Gain and loss

- `positive` and `negative` colour **changes only**: `ChangeBadge` (text plus a 12 % tint of the same colour), signed amounts through `toneOf()` (`src/features/portfolio/portfolio-ui.tsx`). Zero is `secondary-text`.
- Prices, values and totals are always `primary-text`, whatever their direction (`FinancialValue` enforces it).
- The other uses in the code are status signals carried over from iOS: the open-market dot (`positive`), the on state of `SwitchRow` (`positive`), the unread dot and destructive actions (`negative`). Do not add decorative uses.
- `warning` means "look at this": stale or partial data, a missing quote, a draft notice.

## Typography

Two faces, loaded by `next/font` in `src/app/[locale]/layout.tsx`:

| Face | Utility | Used for |
|---|---|---|
| Inter | `font-sans` (default on `html`) | Body copy, buttons, fields, table headers, captions |
| Outfit | `font-display` | `h1`–`h3` (base layer), financial values, table cells, stat values, top-bar pills, tabs, rail labels |

`html` sets `font-variant-numeric: tabular-nums`, so figures never change width. Sizes are in rem, so the browser's text size applies.

### Type scale

Each role is one utility that sets size, line height and, where listed, weight and letter spacing. The web scale replaces the phone values on `desk:` (≥ 1024 px with a fine pointer); the tokens change, so the same class works on both.

| Utility | Phone | `desk:` | Weight | Line height | Use |
|---|---|---|---|---|---|
| `text-headline` | 44 px, −0.034em | 36 px, −0.025em | 600 | 1.1 | The hero figure: index value, portfolio value, `FinancialValue style="display"` |
| `text-display` | 34 px | 32 px, −0.015em | 700 / 600 on desk | 1.2 | Page titles (`h1`) |
| `text-price` | 22 px | 18 px | 600 | 1.27 | Secondary financial values (`FinancialValue style="price"`) |
| `text-section` | 20 px | 22 px | 600 | 1.25 | Card and section titles (`h2`), state titles |
| `text-body` | 17 px | 16 px | 400 | 1.3 / 1.4 | Rows, body copy, table cells, fields |
| `text-secondary` | 15 px | 14 px | 400 | 1.33 / 1.4 | Supporting text, pills on desk, compact pills, table headers |
| `text-caption` | 12 px | 12 px | 400 | 1.33 | Labels, dates under prices, footnotes |
| `text-micro` | 11 px | 11 px | 400 | 1.2, 0.06em | Tab-bar labels, uppercase captions (`uppercase`) |

Pages that need a larger marketing size use arbitrary values on top of a role: the landing hero (`HERO_TITLE`, fluid `clamp(2.25rem, 1.2rem + 4.4vw, 4.25rem)`, −0.02em, −0.025em from 640 px) and `HOME_HEADING` (`lg:text-[2.5rem]`). The lead figure of a card or a sidebar uses 26–28 px (`text-[1.625rem]`, `text-[1.75rem]`); see Known gaps in [layout.md](layout.md#known-gaps).

Weights in use: 400 (text), 500 (`font-medium`: desk pills, idle tabs, table names), 600 (`font-semibold`: values, titles, current tab), 700 (`font-bold`: monograms, uppercase eyebrows).

## Radii

| Utility | Phone | `desk:` | Use |
|---|---|---|---|
| `rounded-small` | 12 px | 8 px | Small controls, menu items, link focus shapes, skeletons |
| `rounded-medium` | 18 px | 12 px | Fields, menus, segmented tracks, `StatTile` |
| `rounded-large` | 24 px | 22 px | Phone cards (`Card`), rail tiles, action tiles |
| `rounded-card` | 22 px | 22 px | The `panel` surface, dialogs, toasts, notices |
| `rounded-full` | | | Pills, icon buttons, chips, badges, logos |

The selected segment uses `desk:rounded-[0.5rem]` so it nests inside the 12 px track.

## Elevation and shadows

| Level | Surface | Light | Dark |
|---|---|---|---|
| 0 | Canvas (`app-background`) | | |
| 1 | Card: `panel` utility (or `Card`/`Panel` on desk) | `card-border` + `shadow-panel` | `card-border` hairline, no shadow |
| 1 (raised inside a control) | Selected segment, current rail tile: `bg-raised shadow-raised` | soft shadow | lighter fill, no shadow |
| Bar | Top bar: `bg-elevated-background shadow-bar` | 1 px shadow line | 1 px hairline |
| Floating | Menu (`z-40`), dialog (backdrop `bg-black/40`), toast (`z-50`): `bg-card-background border-card-border shadow-panel` | soft shadow | hairline only |

Dark mode has no shadows: hairline borders carry the structure. Do not add `shadow-sm`/`shadow-md`/`shadow-lg`; use `shadow-panel` or `shadow-raised`.

Stacking: bottom tab bar `z-20`, top bar `z-30`, menus `z-40`, toasts `z-50`.

## Spacing

Tailwind's 4 px step (`1` = 4 px … `10` = 40 px, iOS `space4`…`space40`). Standard values:

| Where | Phone | `desk:` / `lg:` |
|---|---|---|
| Page gutters (`PAGE_CONTAINER`) | 16 px (`px-4`) | 24 px from 640 px (`sm:px-6`) |
| Page top / bottom (`SITE_PAGE`, `SIGNED_IN_PAGE`) | `pt-4 pb-16` | `lg:pt-8` (market pages `lg:pt-6`) |
| Gap between page blocks | `gap-6` | `gap-6`; `lg:gap-8` between a rail and its page, and on `/mercado` |
| Gap between summary cards | `gap-4` | `gap-4` |
| `Card` padding | 20 px (`p-5`), compact 16 px (`p-4`) | 24 px (`desk:p-6`) |
| `Card` title row | `px-5 pt-4` | `desk:px-6 desk:pt-5` |
| `Card` body under a title | `px-5 pt-3 pb-5` | `desk:px-6 desk:pb-6` |
| `Panel` | none (canvas) / 16 px with `always` | `lg:p-6`, title `lg:px-6 lg:pt-5` |
| `MessageCard` | 24 px (`p-6`), `gap-6` | 32 px from 640 px (`sm:p-8`) |
| Table first and last cell | 16 px | 24 px (`desk:`) |
| Dialog | header `pt-4 pr-3 pl-5`, body `px-5 py-4` | header `desk:pt-5 desk:pr-4 desk:pl-6`, body `desk:px-6 desk:pb-6` |
| Landing sections (`HOME_SECTION`) | `py-16` | `md:py-24` |

## Motion

Utilities in `src/ui/theme/motion.css`. Every one has a `prefers-reduced-motion` fallback.

| Utility | Effect | Reduced motion | Used by |
|---|---|---|---|
| `motion-presence` | Fade in and rise 0.5rem, 240 ms ease-out | 150 ms fade | `Dialog` |
| `motion-value` | Fade in and rise 0.35em, 250 ms | none | `FinancialValue`, `ChangeBadge` (keyed on the text, so it runs when the value changes) |
| `motion-toast` | Slide down from the top, 420 ms `cubic-bezier(0.2, 0.9, 0.25, 1)` | 200 ms fade | Toasts |
| `motion-press` | On `:active`: opacity 0.76, scale 0.98, 160 ms | opacity only | Pills, icon buttons, chips, tiles |
| `motion-pulse` | Opacity 0.9 ↔ 0.5, 0.9 s | none | `Skeleton` |
| `motion-shimmer` | A light band across, 1.6 s | none | `ChartShimmer` |

Colour and border changes use `transition-colors` or `transition-[border-color,box-shadow]` with `motion-reduce:transition-none`. Spinners use `animate-spin motion-reduce:animate-none`.

## Dark mode and increased contrast

- Dark values are defined twice in `tokens.css`: under `:root[data-theme="dark"]` (chosen) and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])` (system). Change both when a dark value changes.
- Dark: no shadows; `on-accent` turns near-black so text on bright fills keeps 4.5:1; `--control-outline-width` is 0.
- `prefers-contrast: more` raises the light values of `secondary-text`, `tertiary-text`, `separator`, `chart-grid`, `card-outline`, `hairline`, `card-border` and `field-border` (to `#778396`), strengthens the focus glow and turns on the phone card outline (`--card-outline-width: 1px`). In dark the dark values win, as on iOS.
- `color-scheme` follows the theme, so native controls and scrollbars match.

## Theme switching

- `<html data-theme="system|light|dark">` is rendered on the server from the `theme` cookie (`THEME_COOKIE` in `src/ui/theme/theme.ts`; `parseTheme` falls back to `dark`), so a page never flashes the wrong theme. Dark is the default whatever the OS; `system` follows it.
- `ThemeSwitch` (segmented) and `ThemeMenu` (icon menu) share one store in `controls.tsx`: choosing writes `data-theme`, sets the cookie for a year (`path=/; samesite=lax`) and fires an `investao:theme` event so every theme control on the page updates.
- The browser chrome colour comes from `generateViewport` in the locale layout, from the same cookie: `#f2f3f5` light, `#090b0f` dark, and both keyed on `prefers-color-scheme` for `system`.
