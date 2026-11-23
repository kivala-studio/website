# Design system

The design system is the code in `src/ui` plus `src/app/globals.css`. These documents describe it as implemented.

| Document | Covers |
|---|---|
| [theme.md](theme.md) | Colour tokens, light and dark, increased contrast, typography, radii, shadows, motion |
| [components.md](components.md) | Components and shared class names in `src/ui` |
| [layout.md](layout.md) | Page frames, containers, breakpoints, the top bar and the app shell |

The component gallery at `/dev/design` shows the components live. It is built only when the data mode is not `production` (`next.config.ts`, `src/features/design-gallery`).

## Rules

Each rule is either the owner's standing constraint or is enforced by the code named beside it.

1. **No phone screenshots on the landing page.** Owner's constraint. The landing page's visuals are components drawn in code (`src/features/site/visuals.tsx`); `public/` holds one image, `public/brand/palanca.png`.
2. **Text fields never show an outline.** Owner's constraint, enforced in the base layer of `src/app/globals.css`: every text input, textarea, select and contenteditable has `outline: none` on focus. A focused field shows an accent border and the `--focus-glow` ring instead (`src/ui/components/field-styles.ts`).
3. **Other controls show a focus ring.** Buttons, links, tabs, checkboxes, radios and ranges get `outline: 2px solid var(--focus-ring, var(--accent))` with a 2 px offset (`src/app/globals.css`).
4. **Colours come from tokens.** `src/ui/theme/tokens.css` defines every colour and maps it to a Tailwind colour name. `src/ui/theme/tokens.test.ts` tests the token file. The only raw hex values in `src` components are the Google mark's brand colours (`src/features/auth/provider-marks.tsx`), the language flags (`src/ui/icons/flags.tsx`), the Open Graph card's fixed light values (`src/features/site/og-card.tsx`) and the two `theme-color` values (`src/app/[locale]/layout.tsx`).
5. **Content is grouped in flat cards on a tinted canvas.** The `panel` utility is a card fill with a transparent edge and no shadow; the edge is drawn only with increased contrast (`src/app/globals.css`, `src/ui/theme/tokens.css`). Menus, dialogs and toasts keep a faint edge and a soft shadow.
6. **Actions are pills.** `Button`, `ButtonLink` and `buttonClass` are fully rounded (`src/ui/components/button-styles.ts`).
7. **Targets are at least 44 px.** Pills are 56 px on phones and 44 px on wide pointer screens; icon buttons 48 px and 44 px; chips and rows 44 px or more (`src/ui/components/button-styles.ts`).
8. **Headings and financial values use the display face.** `font-display` (Outfit) for headings, financial values, table cells and navigation; Inter for body copy, buttons, fields and table headers (`src/app/[locale]/layout.tsx`, `src/app/globals.css`).
9. **Numbers use tabular figures.** `font-variant-numeric: tabular-nums` on `html`.
10. **Gain and loss colours apply to changes.** `ChangeBadge` and `chartTone` use `positive` and `negative` (`src/ui/components/financial.tsx`, `src/features/chart/price-chart.tsx`).
11. **Light and dark are both supported, and so is reduced motion.** See [theme.md](theme.md).
12. **User-visible strings come from the message catalogue.** See [../i18n.md](../i18n.md).
13. **No inline styles.** The CSP allows styles only from the site or with the request's nonce in production (`src/config/security.ts`); charts set colours through classes (`src/features/chart/price-chart.tsx`).
