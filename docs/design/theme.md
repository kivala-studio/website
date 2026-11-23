# Theme

Sources: `src/ui/theme/tokens.css`, `src/app/globals.css`, `src/ui/theme/motion.css`, `src/ui/theme/theme.ts`.

## Light, dark and system

- `<html data-theme="light|dark|system">` is rendered on the server from the `theme` cookie (`src/app/[locale]/layout.tsx`).
- `parseTheme` returns `dark` when the cookie is missing or invalid (`src/ui/theme/theme.ts`).
- `system` follows `prefers-color-scheme`: the dark values apply under `@media (prefers-color-scheme: dark)` to `:root:not([data-theme="light"])`.
- `ThemeSwitch` writes the cookie for one year (`src/ui/components/controls.tsx`). A theme change cross-fades the page (`src/ui/motion/theme-transition.ts`).
- The browser's `theme-color` is `#f3f6fd` (light) or `#080b12` (dark) (`generateViewport`).
- `prefers-contrast: more` changes the light values listed below and gives the dark card an edge.

## Semantic colours

Each is available as a Tailwind colour (`bg-accent`, `text-primary-text`, …). The file's header states the values are transcribed from the iOS `SemanticColors.swift`.

| Token | Light | Dark | Light, increased contrast |
|---|---|---|---|
| `app-background` | `#f2f3f5` | `#090b0f` | |
| `elevated-background` | `#ffffff` | `#12151b` | |
| `card-background` | `#ffffff` | `#171b22` | |
| `primary-text` | `#182231` | `#f5f7fa` | |
| `secondary-text` | `#485364` | `#a6afbd` | `#283445` |
| `tertiary-text` | `#596579` | `#747e8e` | `#3b4759` |
| `accent` | `#1854c5` | `#5a9bff` | |
| `on-accent` | `#ffffff` | `#090b0f` | |
| `positive` | `#08704c` | `#35c98b` | |
| `negative` | `#b9233d` | `#ff6677` | |
| `warning` | `#845000` | `#f5b544` | |
| `separator` | `#c5cdd8` | `#2a303a` | `#778396` |
| `chart-grid` | `#cbd2dc` | `#252b34` | `#778396` |
| `card-outline` | `#c9d0db` | `#2a303a` | `#778396` |
| `control-outline` | `#778396` | `#2a303a` | |
| `selected-tab-background` | `#e2eafa` | `#303238` | |
| `widget-background` | `#f2f3f5` | `#090b0f` | |
| `action-surface` | `#e5e9ef` | `#171e2b` | |
| `accent-soft` | `#e2eafa` | `#192d4b` | |
| `comparison-orange` | `#a34e00` | `#ff9400` | |
| `comparison-purple` | `#7935b5` | `#ad52e0` | |
| `brand-violet` | `#6e4fd6` | `#6e4fd6` | |

## Web surface tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#f3f6fd` | `#080b12` | The page, bars and sticky strips |
| `panel-edge` | transparent | transparent | The card's edge; `#778396` (light) or `#5d6778` (dark) with increased contrast |
| `stage-brand` / `on-stage-brand` | `#5a9bff` / `#0a1a3f` | same | Full-bleed sections, the footer band |
| `stage-deep` / `on-stage-deep` | `#0c2257` / `#f5f7fa` | `#0f2a66` / `#f5f7fa` | Hero panel, deep sections |
| `stage-ink` / `on-stage-ink` | `#0e141f` / `#f5f7fa` | `#1b2433` / `#f5f7fa` | Solid cards |
| `stage-pale` / `on-stage-pale` | `#d7e1f3` / `#182231` | `#2e3b54` / `#f5f7fa` | Solid cards |
| `accent-soft-hover` | accent 10 % over `accent-soft` | accent 14 % | Hover of a soft accent fill |
| `hairline` | `#e6e9ee` | `#232933` | Row dividers |
| `card-border` | `rgb(24 34 49 / 0.07)` | `#232933` | Menu, dialog and toast edges |
| `field-border` | `#dfe3e9` | `#2a303a` | Search and text fields |
| `track` | `#e8edf7` | `#0f1217` | Segmented-control groove |
| `raised` | `#ffffff` | `#262c36` | The selected segment |

Shadows: `shadow-panel`, `shadow-raised`, `shadow-bar`, `shadow-float` and `shadow-focus` (the field's focus glow: a 3 px ring of the accent at 18 % in light, 30 % in dark, 45 % with increased contrast). In dark, `panel-shadow` and `raised-shadow` are `none`.

## Typography

Fonts are loaded with `next/font/google` and served from the site's origin: Inter (`--font-inter`, `font-sans`) and Outfit (`--font-outfit`, `font-display`) (`src/app/[locale]/layout.tsx`).

Sizes are in rem. The second column applies on screens at least 64rem wide with a fine pointer.

| Role | Default | Wide pointer screens | Use |
|---|---|---|---|
| `text-headline` | 2.75rem, 600 | 2.25rem | Hero price, portfolio value |
| `text-display` | 2.125rem, 500 | 2rem | Page titles |
| `text-price` | 1.375rem, 600 | 1.125rem | Secondary financial values |
| `text-section` | 1.25rem, 500 | 1.375rem | Section headers |
| `text-body` | 1.0625rem | 1rem | Rows, body copy |
| `text-secondary` | 0.9375rem | 0.875rem | Supporting text |
| `text-caption` | 0.75rem | | Labels, footnotes |
| `text-micro` | 0.6875rem, letter-spacing 0.06em | | Eyebrows, uppercase |

Marketing roles, fluid with the viewport, weight 400:

| Role | Size |
|---|---|
| `text-hero` | `clamp(2.5rem, 1.5rem + 4.4vw, 5rem)` |
| `text-heading` | `clamp(2.25rem, 0.9rem + 5.8vw, 6rem)` |
| `text-statement` | `clamp(1.5rem, 1.25rem + 0.7vw, 1.875rem)` |
| `text-lead` | `clamp(1.125rem, 0.95rem + 0.6vw, 1.5rem)` |

`h1`, `h2` and `h3` use the display face at weight 500 in the base layer.

## Radii and spacing

| Token | Default | Wide pointer screens |
|---|---|---|
| `rounded-small` | 0.75rem | 0.5rem |
| `rounded-medium` | 1.125rem | 0.75rem |
| `rounded-large` | 1.5rem | |
| `rounded-card` | 1.5rem | |

Spacing uses Tailwind's 4 px step.

## Variants

| Variant | Condition | Defined in |
|---|---|---|
| `desk:` | `min-width: 64rem` and `pointer: fine` | `src/app/globals.css` |
| `fine-hover:` | `hover: hover` and `pointer: fine` | `src/ui/theme/motion.css` |

## Motion

Sources: `src/ui/theme/motion.css` (tokens and utilities), `src/ui/motion` (hooks and script access to the tokens), `src/ui/components/motion.tsx`.

### Tokens

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 140 ms | Hover, press, colour, small exits. The default for a bare `transition-*` utility |
| `duration-base` | 220 ms | Small moves: indicators, chevrons, menus |
| `duration-slow` | 340 ms | Panels and large moves: sheets, disclosures, the theme cross-fade |
| `duration-reveal` | 400 ms | The landing page's one-time scroll reveal |
| `duration-draw` | 650 ms | Chart lines drawing in |
| `duration-flash` | 900 ms | The tint behind a live figure that changed |
| `ease-standard` | `cubic-bezier(0.25, 0.8, 0.25, 1)` | Colour and state changes |
| `ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything that moves or enters |
| `ease-exit` | Same curve as `ease-emphasized` | Anything that leaves |

Scripts read the same values through `motionDuration` and `motionEasing` (`src/ui/motion/tokens.ts`).

### Rules stated in `motion.css`

- Only transforms, opacity, clip-path, colours and shadows move; disclosures also animate their height.
- Nothing loops except loading placeholders.
- Every pattern has a reduced-motion fallback: movement goes, a short fade or an instant change stays.
- Hover that moves something applies only under `fine-hover`.

### Utilities

`motion-press`, `motion-tap`, `motion-lift`, `motion-turn`, `motion-swap`, `motion-appear`, `motion-fade-in`, `motion-presence`, `motion-pop`, `motion-modal`, `motion-sheet`, `motion-toast`, `top-bar-float`, `top-bar-backing`, `motion-drop`, `motion-dim`, `motion-collapse`, `motion-details`, `motion-pulse`, `motion-shimmer`, `motion-spin`, `motion-entrance`, `motion-entrance-lift`, `entrance-delay-*`, `motion-drift-swell`, `motion-drift-rock`, `motion-drift-slide`.

### Hooks

`src/ui/motion`: `useSlidingIndicator` (a selected item's fill glides to the next), `useChangeAnimation`, `useChartMotion`, `useEntrance`, `usePresence`, `useSwipeDismiss`, plus `glide.ts`, `live.ts` and `theme-transition.ts`.
