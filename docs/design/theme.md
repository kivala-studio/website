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
| `accent-soft` | `#e2eafa` | `#192d4b` | | Selected chip, icon discs, the profile initials, the landing glow, the feature rows' icon squircles and stage tint |
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
| `--hero-glow` | `hero-glow`, `showcase-halo`, `bento-wash`, `feature-stage` | accent at 11 % | accent at 22 % | | Peak of the landing's accent light. The utilities (`globals.css`; `bento-wash` lights the largest bento card and the Plus panel from the top right; `feature-stage` is the feature visuals' stage: `accent-soft` at 38 % over the canvas, the light from the top and a fine grid fading out before its lower half) are radial gradients with eased stops that end transparent inside their box; `hero-grid` is the fine grid that fades out before the edges; `HeroBackdrop edge="bottom"` mirrors glow and grid for the landing's close |

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

Pages that need a larger marketing size use arbitrary values on top of a role: the landing hero (`HERO_TITLE`, fluid `clamp(2.25rem, 1.2rem + 4.4vw, 4.25rem)`, −0.02em, −0.025em from 640 px), the closing line (`CLOSING_TITLE`, fluid `clamp(2.125rem, 1.4rem + 2.8vw, 3.5rem)`, same tracking) and `HOME_HEADING` (`lg:text-[2.5rem]`). The lead figure of a card or a sidebar uses 26–28 px (`text-[1.625rem]`, `text-[1.75rem]`); see Known gaps in [layout.md](layout.md#known-gaps).

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
| Landing feature rows (`FeatureRows`) | `gap-16 pt-8` (64 px between rows and from the bento) | `md:gap-24 md:pt-14` (96 px) |
| Landing close (Plus, the closing line, the footer) | `HOME_SECTION` for Plus, then `pb-16` under the closing pills | `md:pb-24`: 96 px from Plus to the closing line and from the pills to the footer hairline |
| Footer (`SiteFooter`) | `pt-8 pb-8`, `gap-8`; no top margin (the page's bottom padding is the gap) | `md:pt-12 md:pb-10`, `md:gap-10` |

## Motion

Everything that moves or changes is animated, so the app feels alive: quick, calm, never bouncy, never in the way. One vocabulary, defined once in `src/ui/theme/motion.css`; scripts read the same tokens through `src/ui/motion/tokens.ts`. The live reference is the Motion section of `/dev/design`.

### Tokens

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--duration-fast` | `duration-fast` | 140 ms | Hover, press, colour, focus glow, small exits (menus, dialogs) |
| `--duration-base` | `duration-base` | 220 ms | Small moves: indicators, chevrons, switch thumbs, value rolls, menus in, panel exits |
| `--duration-slow` | `duration-slow` | 340 ms | Panels and large moves: sheets in, disclosures, toasts in, the theme cross-fade |
| `--duration-reveal` | | 550 ms | The landing's one-time entrance and scroll reveal only |
| `--duration-flash` | | 900 ms | The tint behind a live price that just changed, fading out (`valueFlash`) only |
| `--ease-standard` | `ease-standard` | `cubic-bezier(0.25, 0.8, 0.25, 1)` | Colour and state changes (the default of every `transition-*` utility) |
| `--ease-emphasized` | `ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything that moves or enters: a fast start, a long settle. `--ease-reveal` is its landing name |
| `--ease-exit` | `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Anything that leaves: it accelerates away |

A bare `transition-colors`, `transition-opacity` or `transition-[…]` is `fast` and `standard` (`--default-transition-*`). Never write `duration-150`, `duration-[…]`, `ease-out` or a raw curve: pick a token.

### When something changes, use

| What changes | Pattern | Technique | Reduced motion |
|---|---|---|---|
| The selected item of a group (segments, tabs, nav pills, rail tiles, the tab bar, a single-choice chip group) | The indicator glides from the old item to the new one, also across a route change | `useSlidingIndicator` (`src/ui/motion`): the selected item draws the indicator with `::before` (fill, `INDICATOR_FILL`) or `::after` (underline); the hook animates it from the old box with `element.animate(…, { pseudoElement })`, counter-scaling its corners. Idle items carry `INDICATOR_IDLE` so the fill passes under their labels. `memory` keeps the last position for a group that a route change renders again | Instant |
| Pressing anything tappable | `motion-press` (pills, icon buttons, chips, tiles, segments, rail tiles, tabs of the tab bar): 98 % and dimmed; `motion-tap` (rows, large surfaces): dimmed only | CSS `:active`; the utility also fades the control's colours, fills, shadow, filter and disabled opacity, so don't add `transition-colors` beside it | No scale |
| Hovering an interactive card | `motion-lift`: 1 px up (mouse only), plus the card's own `hover:border-field-border` | CSS, `@media (hover: hover)` | No movement |
| Hovering a row, a link, a plain control | `transition-colors` with a `hover:` fill or text colour | CSS | Unchanged |
| A field gaining focus | The accent border and `shadow-focus` glow fade in (`fast`) | `INPUT`, `INPUT_BOX`, `FIELD` | Unchanged (a fade) |
| A switch | The thumb slides (`base`, emphasized), the track colour fades | `SwitchRow` | Thumb jumps, colour fades |
| A chevron, a sort arrow | Turns with its state (`motion-turn` + `group-open:rotate-180`, `group-aria-expanded:rotate-180`) | CSS | Instant |
| One icon replacing another | Cross-shrink: `IconSwap` (both icons in one cell, `turn` adds a quarter turn: menu ↔ close); `IconButton` grows a new `icon` in by itself | CSS / `useChangeAnimation` | Fade only |
| A dot, check or badge coming and going in place | `motion-appear` with `data-hidden` (the unread dot, menu checks, the sort arrow) | CSS | Fade only |
| A number changing (a price, a change, a count, a total) | It rolls in: up from below when it rises, down from above when it falls (`base`) | `AnimatedText` (used by `FinancialValue` and `ChangeBadge`) or `useChangeAnimation` + `valueRoll`; Web Animations, so it plays only when the value changes, never on load or when a hidden wrapper is shown again | A short fade |
| A live quote changing (a poll, a realtime update) | It rolls and a tint of its direction (positive up, negative down) fades out behind it (`flash`) | `AnimatedText live` / `FinancialValue live`: only a current quote replacing a current quote. The first quote replacing the dated close, a revoked quote, more than 12 figures in one update and anything in the 3 s after the tab comes back from the background simply update (`playLive`) | The tint stays (a fade), no roll |
| The market status | Its dot's colour fades and its label rolls (`MarketStatusIndicator`) | CSS + `AnimatedText` | Fade |
| A chart's series (another range, a scenario, data that arrived) | Mounted after hydration (a client navigation, a sheet, data after a loading state): the line wipes in from the left once (`slow`). Another series: the old one fades out over the new one fading in, and the axis labels fade in | `useChartMotion(plot, ghost, key, { draw })`: `plot` is the group React draws the series into, `ghost` an empty sibling group for the outgoing copy; `key` is the drawn content (count, first and last point), never the array, so a poll that changes nothing replays nothing. The crosshair and its readout follow the pointer at once | Fades only, no wipe |
| A share or a level (an allocation weight, an order-book depth) | The bar grows or shrinks from where it was (`slow`, emphasized) | `Meter`, or an SVG `rect` sized by its attributes + `useChangeAnimation(rect, value, barGrow)`: no inline width | Instant |
| A step of a flow (account setup, a wizard) | The new step slides in from the side it is on (from the right going forward) and fades; the progress fill glides to the new segment | `useChangeAnimation(body, step, stepSlide(direction))`, guarded so the hydration swap does not play; the progress segments are a sliding-indicator group | Fade only |
| Whether figures are shown (privacy mode) | The page cross-fades between masked and shown figures (`base`) | `crossFadePage(update)` (`document.startViewTransition` + `flushSync`) | Instant |
| A list reordering, growing or shrinking | Items glide to their new places; new ones fade in | `FlipList` (items need `data-flip-key`); reads positions before and after React's update | Instant |
| Content replacing a skeleton, a state swap (loaded, empty, error) | The new content fades in (`motion-fade-in`); a message or notice fades and rises (`motion-presence`) | Only for content mounted after hydration: `useEntrance()` (the state components do it themselves), so server-rendered content never fades in on load | Fade stays |
| A disclosure opening and closing | Height grows and folds | `Collapse` (grid rows, React-controlled) or `motion-details` on a `<details>` (`::details-content` + `interpolate-size`; browsers without it open at once) | Instant (`Collapse` fades) |
| A menu or popover | Grows from its trigger's corner, shrinks back on close | `usePresence` + `motion-pop` (`origin-top-right`/`-left`); `@starting-style` for the entry, a closing state for the exit | Fade only |
| A dialog or sheet | `motion-modal`: rises and grows from 96 %; `motion-sheet`: slides from the bottom (phones) or the right (768 px and up); the backdrop fades | `@starting-style` in; out with `display`/`overlay` `allow-discrete` after `close()`, so the page is usable at once. Browsers without `overlay` (Safari, Firefox today) close at once. A dialog that shows a value (the record being edited, the tile whose details are open) is rendered from `usePresenceValue(value)`: it keeps the value through the exit, then unmounts, and its `key` changes on each opening, so every opening starts fresh and nothing runs while it is closed | Fade only |
| A toast | Slides down from the top; lifts and fades away when dismissed, timed out or replaced | `ToastHost` keeps the leaving toast for its exit | Fades |
| The top bar's menu | Drops from under the bar, page dims (`motion-drop-in/out`, `motion-dim-in/out`) | Phases in `TopBar` | Fades |
| Another page (a link, the tab bar, the site header) | The new page is there at once; the old one dissolves over it (`base`). The bars, header and footer the two share stay exactly where they are | `PageTransition` (React `<ViewTransition exit>`) in each route group's `template.tsx` and around each group's layout; only the leaving page is a participant, so the new page takes clicks from its first frame. A change of query on the same page (a sort, a filter, a search) is no page change: its lists glide in place | Instant |
| Light ↔ dark | One cross-fade of the whole page (`slow`) | `switchTheme()` (`document.startViewTransition`); per-element colour transitions are off while it switches (`data-theme-switching`), so nothing lags. Instant where unsupported | Instant |
| Loading | `motion-pulse` (`Skeleton`), `motion-shimmer` (`ChartShimmer`), `motion-spin` (`Spinner`, fades in as it starts) | The only loops | No pulse, shimmer or spin |
| The landing | `motion-entrance`, `motion-entrance-lift`, scroll reveal (`data-reveal`, `Reveal`) | One-time, `reveal` duration; see below | Nothing hidden, no movement |

### Rules

- **What may move:** `transform` (and `translate`, `scale`, `rotate`), `opacity`, `clip-path`, colours and shadows. Disclosures also animate height (grid rows or `::details-content`). Never animate `width`, `left`, `margin` or `padding`.
- **Enter and exit.** Things that disappear leave: use a pattern above that has an exit, keep the component mounted (drive `open`) and let it unmount after its exit. While leaving, an element is `inert` and hidden from assistive technology.
- **Interruptible.** Transitions over keyframes for anything that can be reversed (menus, dialogs, disclosures, switches); scripts start a new glide from where the old one is. Rapid clicks never leave a stuck state.
- **Never blocking.** Nothing waits for an animation before it reacts to input; a closed dialog frees the page at once.
- **Nothing on load.** Server-rendered content is simply there (`useEntrance`, Web Animations on change only). The largest paint is never faded.
- **No loops** but the loading placeholders; nothing runs when the page is idle.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every utility in `motion.css` has its fallback; scripts check `prefersReducedMotion()`. Movement goes; short fades and colour changes stay.
- **No inline styles.** The CSP is nonce-based and a test forbids `style=` in the HTML. Drive motion with classes and `data-*` attributes, `@starting-style`, the Web Animations API (`element.animate`, which sets no attribute), View Transitions, or `view-transition-name` through a class (`[view-transition-name:…]`). Never set CSS variables from scripts through `style`.

Do: reach for the pattern table first; use the tokens; give every new pattern a reduced-motion fallback in `motion.css` and a specimen in the gallery's Motion section.
Don't: add an animation library; animate on every render; fade in server-rendered content; bounce or overshoot; animate the colour of a price (gain and loss colour is for changes only: the one exception is the brief tint behind a live quote that just changed, which fades to nothing); add a `transition-*` beside `motion-press`, which owns the transition; key a chart's motion on an array (every poll makes a new one); animate a timestamp, a crosshair readout or a scrubbed value (they follow the pointer or the clock and would never settle).

### Hooks and pieces (`src/ui/motion`, `src/ui/components`)

| Export | From | |
|---|---|---|
| `useSlidingIndicator(selection, { selector, pseudo?, memory? })` | `@/ui/motion/use-sliding-indicator` | Returns the ref for the group; see the table above |
| `usePresence(open, { timeout? })` | `@/ui/motion/use-presence` | `{ mounted, state, presenceProps }`: render while `mounted`, spread `presenceProps` (`data-state`, `inert`, `aria-hidden`, end handlers) on the animated element |
| `usePresenceValue(value, { timeout? })` | `@/ui/motion/use-presence` | `{ value, open, key }` for a dialog that shows a value: render while `value`, pass `open`, key it with `key`. Pass a stable value or a boolean, never a new object literal |
| `useChangeAnimation(ref, value, animation, isSame?, schedule?)` | `@/ui/motion/use-change-animation` | Plays one or more Web Animations when `value` changes; `valueRoll(direction)`, `valueFlash(direction)`, `barGrow(before, after)`, `stepSlide(direction)`, `ICON_IN`, `FADE_IN` |
| `playLive(play)` | `@/ui/motion/live` | The scheduler for figures a poll changes: drops a burst (more than 12 in one update) and anything just after the tab comes back |
| `useChartMotion(plot, ghost, key, { draw })` | `@/ui/motion/use-chart-motion` | A chart's draw-in and series cross-fade |
| `crossFadePage(update)` | `@/ui/motion/theme-transition` | Cross-fades a page-wide change of figures |
| `PageTransition` | `@/ui/motion/page-transition` | The page dissolve; only in `template.tsx` and the group layouts |
| `useEntrance()` | `@/ui/motion/use-entrance` | `true` for content mounted after hydration |
| `switchTheme(update)` | `@/ui/motion/theme-transition` | Cross-fades a theme change |
| `motionDuration`, `motionEasing`, `prefersReducedMotion` | `@/ui/motion/tokens` | The tokens for scripts |
| `IconSwap`, `Collapse` | `@/ui/components/motion` | Server-safe |
| `AnimatedText` | `@/ui/components/animated-value` | A figure that rolls when it changes; `live` adds the direction tint |
| `Meter` | `@/ui/components/meter` | A share as a thin bar that grows from where it was |
| `FadeIn` | `@/ui/components/states` | A `div` that fades (`rise`: and rises) in when mounted after hydration: content replacing a skeleton or another state |
| `FlipList` | `@/ui/components/flip-list` | A list whose items glide on reorder |

### Landing

| Utility | Effect | Reduced motion | Used by |
|---|---|---|---|
| `motion-entrance` | Once on load: fade in and rise 0.75rem, `reveal` duration, emphasized, after `entrance-delay-<ms>` (`backwards` fill: nothing stays applied) | none | The landing hero's subtitle, search and pills, figures and showcase (70, 140, 210, 280 ms) |
| `motion-entrance-lift` | Once on load: rise 0.5rem with no fade and no delay, 500 ms | none | The landing `h1` (no fade, so the largest paint is the first) |
| Scroll reveal (`data-reveal`) | Once as it enters the viewport: fade in and rise 0.875rem; targets entering together 60 ms apart, a `data-reveal="stagger"` group's children 100 ms apart; `reveal-line` wipes a chart line in from the left, `reveal-after` fades the area and dot in after it | nothing hidden, no movement | Landing sections below the hero (`Reveal`, see [components.md](components.md#landing-pieces-featuressitehome-featuressitevisuals)) |

The reveal's start state exists only on a screen that allows motion, after the `Reveal` script has marked a target still below the fold (`data-reveal-state="pending"`); without JavaScript, before hydration, in print, with reduced motion and for a focused target, every section is simply there.

## Dark mode and increased contrast

- Dark values are defined twice in `tokens.css`: under `:root[data-theme="dark"]` (chosen) and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])` (system). Change both when a dark value changes.
- Dark: no shadows; `on-accent` turns near-black so text on bright fills keeps 4.5:1; `--control-outline-width` is 0.
- `prefers-contrast: more` raises the light values of `secondary-text`, `tertiary-text`, `separator`, `chart-grid`, `card-outline`, `hairline`, `card-border` and `field-border` (to `#778396`), strengthens the focus glow and turns on the phone card outline (`--card-outline-width: 1px`). In dark the dark values win, as on iOS.
- `color-scheme` follows the theme, so native controls and scrollbars match.

## Theme switching

- `<html data-theme="system|light|dark">` is rendered on the server from the `theme` cookie (`THEME_COOKIE` in `src/ui/theme/theme.ts`; `parseTheme` falls back to `dark`), so a page never flashes the wrong theme. Dark is the default whatever the OS; `system` follows it.
- `ThemeSwitch` (segmented) and `ThemeMenu` (icon menu) share one store in `controls.tsx`: choosing sets the cookie for a year (`path=/; samesite=lax`), then writes `data-theme` and fires an `investao:theme` event inside `switchTheme`, so the page cross-fades to the new theme and every theme control updates.
- The browser chrome colour comes from `generateViewport` in the locale layout, from the same cookie: `#f2f3f5` light, `#090b0f` dark, and both keyed on `prefers-color-scheme` for `system`.
