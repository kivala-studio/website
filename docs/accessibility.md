# Accessibility

What the code implements and what the tests check. This is not an audit result.

## Checked by tests

- Playwright runs axe (`@axe-core/playwright`) in 19 spec files and fails on any `serious` or `critical` violation (for example `tests/e2e/foundation.spec.ts`, `tests/e2e/site.spec.ts`, `tests/e2e/design.spec.ts`). The gallery is scanned in light and dark.
- `tests/e2e/design.spec.ts` drives tabs, radio groups and dialogs from the keyboard.
- `tests/e2e/public.spec.ts` has a "without JavaScript" group.
- Lighthouse requires an accessibility score of at least 0.95 on `/` and `/policy` (`lighthouserc.json`).

## Implemented in code

| Topic | Implementation |
|---|---|
| Focus | `:focus-visible` ring of 2 px in the accent, offset 2 px; on a stage fill the ring takes the fill's on-colour through `--focus-ring`. Text fields show an accent border and a glow instead of an outline (`src/app/globals.css`, `src/ui/components/field-styles.ts`) |
| Target size | Pills 56 px (44 px on wide pointer screens), icon buttons 48 px (44 px), chips, rows and links at least 44 px (`src/ui/components/button-styles.ts`) |
| Landmarks | Each page renders `<main id="main">`. Navigation groups are `<nav aria-label>`; the current item has `aria-current="page"` (`src/features/shell/shell-nav.tsx`) |
| Language | `<html lang="pt-AO|en-AO">`; article text is marked `lang="pt-AO"` |
| Contrast | `prefers-contrast: more` darkens secondary and tertiary text and draws separators, card edges and field borders (`src/ui/theme/tokens.css`). Stage fills are paired with an on-colour; the token file states they meet AA |
| Motion | Every motion utility has a reduced-motion fallback (`src/ui/theme/motion.css`); scripts check `prefersReducedMotion()` (`src/ui/motion/tokens.ts`). Nothing loops except loading placeholders |
| Text size | Type sizes are in rem (`src/app/globals.css`) |
| Status messages | Notices use `role="status"`, errors `role="alert"` (for example `src/app/[locale]/(auth)/entrar/page.tsx`, `src/features/auth/sign-in-options.tsx`) |
| Charts | Pointer and arrow keys select the nearest real observation (`src/features/chart/price-chart.tsx`, `src/features/simulation/simulation-chart.tsx`) |
| Reordering | The watchlist can be reordered one step at a time from the row menu, without a pointer (`src/features/watchlist/watchlist-view.tsx`) |
| Focus management | After a view change on `/planos`, focus moves into the new view (`src/features/billing/plans-view.tsx`). After the Home Plus prompt is dismissed, focus moves to what follows it (`src/features/home/plus-prompt.tsx`) |
| Hidden values | Privacy mode replaces values with a mask; the real value is not in the page (`src/features/portfolio/portfolio-ui.tsx`) |
| Icons | `Icon` takes an accessible `label`; decorative marks are `aria-hidden` |
| Without JavaScript | The market list, news feed, news search and the landing page's market search work as links and GET forms |

## Not present

- No "skip to content" link was found in `src/features/site/chrome.tsx`, `src/ui/components/top-bar.tsx` or the layouts.
