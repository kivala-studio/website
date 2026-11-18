# Patterns

Recurring rules that cut across components. Where AGENTS.md has a standing rule, it governs; this page says how the code applies it.

## Prices and validity

Standing rules 2 (prices) and 3 (cached HTML) in [AGENTS.md](../../AGENTS.md) are the rule. In the code:

- **Lists** show a price only through `PriceCell` / `rowFigure` (`src/features/market/browse/price-cell.tsx`): a current price once the market store has assessed the quote as usable, otherwise the server's dated verified close with its date, otherwise "Preço por confirmar" (`common.priceUnconfirmed`).
- **Cached pages** (the landing) pass `security={undefined}` and `at={undefined}`, so they can only show the dated close.
- **The instrument page** (`instrument-view.tsx`) puts the validity line under the price: the quote label and its day, or "Último fecho verificado · date" (`market.price.lastVerifiedClose`), or the reason the reference is unavailable. The wording comes from `MARKET_MESSAGE_KEYS` in `src/domain/market`; never write your own.
- A value that is not usable is a muted "—" (`text-tertiary-text`, `aria-hidden` when the row already says why), never a zero and never an old number shown as current.
- Market state is the server calendar's (standing rule 4): show it with `MarketStatusIndicator`.

## Numbers

- Standing rule 5: `Decimal` for every money, ledger, threshold and valuation value. No JavaScript `number` arithmetic on them; convert with `toNumber()` only at the drawing edge (chart coordinates).
- Format through `useFormat()` (`@/ui/format`) on the client and `createFormat()` on the server: `securityPrice`, `currency`, `percent`, `quoteChange`, `count`, `quantity`, `number`, `chartAxis`, `civilDate`, `timestamp`. Never `toFixed`, `toLocaleString` or string concatenation of amounts.
- Amount input is `AmountField`; parse its text with `parseAmount()` (`@/domain/format/amount-input`).
- Figures use tabular numerals everywhere (set on `html`). Financial values use `font-display`.
- Changes carry their sign and colour (`ChangeBadge`, `toneOf()`); totals and prices stay neutral.

## Privacy mode

Personal figures (quantities, values, costs, gains, cash, income) can be hidden per browser.

- The preference lives in the `investao-privacy` cookie, so the server renders hidden values hidden and nothing flashes.
- Put `PrivacyModeButton` in the title row of every page that shows personal figures.
- Render each personal figure through `Private` (`@/features/portfolio/portfolio-ui`) or `HiddenValue`: the mask (six dots) is announced as "Valor oculto" and the value is not in the page.
- Lists that could reveal position size by their order sort by id while hidden (`orderWhileHidden`).
- Market data (prices, changes, volumes) is public and never masked.

## Loading, empty, error, stale

Every data block has all four.

| State | Pattern |
|---|---|
| Loading | Skeletons shaped like the content, inside the same card (`Skeleton`, `InstrumentRowSkeleton`, `ChartShimmer`), with `role="status"` or `aria-busy` and an accessible label. `LoadingState` only when a whole view loads. Never fake data |
| Empty | `EmptyState`: icon, title, one line, and the next step as the action (add instruments, record a purchase, clear filters) |
| Error | `ErrorState` with a "Tentar novamente" secondary pill; `SectionPlaceholder failed` for one section among others. No automatic retries (standing rule 9) |
| Stale | Keep what is on screen and say so: a `text-warning` caption (`home.summary.staleData`) or the dated close instead of the quote. `OfflineBanner` at the top while offline |
| Partial | A `text-warning` line under the block (`portfolio.dashboard.partialValuesNotice`) |

## Copy

- Standing rule 11 and important rule 1 in AGENTS.md: Angolan Portuguese addressing the user as "tu", sentence case, iOS wording verbatim from the message catalogue, no taglines, helper text or secondary labels.
- Every visible string and every accessible name comes from `t("…")`. `messages/*.json` is generated from the iOS catalogue by `npm run messages`; web-only strings (marketing, legal, SEO) go in the `site` namespace, which the converter keeps.
- Client components receive only `CLIENT_NAMESPACES` plus their area's `AREA_KEYS` (`src/i18n/client-messages.ts`). Add the keys a new client component reads there.
- The `/dev/design` gallery is the only place with untranslated labels (specimen names, sample instruments). It is never built in `production` data mode.

## Focus

- Buttons, links, tabs and custom controls show the ring from the base layer: `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`. Never remove it. Give link-like blocks a `rounded-*` class so the ring follows the shape.
- When a link covers a whole row through an overlay (`TableNameCell href`), the ring is drawn on the overlay (`focus-visible:after:outline-…`).
- Menu items show a soft fill on focus instead of the ring.
- Text fields never show an outline: the border turns `accent` and the `shadow-focus` glow appears. Use `INPUT`, `INPUT_BOX` or `SearchField`; for a button that looks like a field (the command palette trigger) use `focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none`.
- Every control is reachable by keyboard. Composite controls (tabs, segmented controls, menus) use roving focus with the arrow keys, Home and End; they are already built that way.

## Illustrative visuals

The landing's product visuals (`InstrumentVisual`, `WatchlistVisual`, `PortfolioVisual`) and the bento miniatures (`SimulatorMiniature` and the others in `BentoCard`):

- One accessible name per figure (`role="img"` + `aria-label` from the catalogue) or per bento card (its title, the link's name); everything inside is `aria-hidden`, not selectable and has no controls.
- Captioned "Exemplo ilustrativo" (`IllustrativeCaption`): under each visual's stage, and once under the whole bento grid, never per card.
- Sample values only: the iOS onboarding's sample instruments (BAI, BFA) and round invented figures; sample text is catalogue wording with sample arguments. Never market data, never a live or current price.
- Built from the real primitives (`StatTile`, `ChangeBadge`, `SecurityLogo`, chips, the segmented track) so they match the product.
- Composed, not pasted: on the feature rows the main card fills the stage and the floating card overlaps it without covering text (it sits over a chart's faded area or the main card's padding), so no strip of the stage is left empty and nothing is cut mid-content.

Decorative backgrounds (`HeroBackdrop`, the `Showcase` halo, `bento-wash`) are `aria-hidden`; the `feature-stage` light and grid are backgrounds of the figure itself.

## Icons

- Only icons from the pack (`Icon`, `ICON_PACK`). A missing icon is added to `design/icon-pack/masters.json` and generated with `npm run icons`.
- Decorative by default. An icon-only control is an `IconButton` (required `label`) or carries `sr-only` text.
- Colour: `secondary-text` idle, `accent` for the current or selected item and inside icon discs, `warning` beside warnings, `tertiary-text` for trailing chevrons.
- Size follows the text: `scale` (`s`, `m`, `l`) or a text size on the icon (`text-[1.25rem]`).
- Icon discs: `rounded-full bg-accent-soft text-accent` at `size-10`, `size-12` or `size-14`.

## "See all"

- A card that previews a longer list puts `SeeAll` in its header `action`: the outline compact pill "Ver tudo", linking to the full list.
- One per card. Other header actions use the same outline compact pill (`ButtonLink kind="outline" size="compact"`).
- Under a preview table on the landing, the link is a centred outline pill in the card's footer.

## Page-level actions

- Actions that act on the whole page are pills in the title row (icon buttons: privacy, refresh, share) or in one row under the title.
- One primary pill per page (`kind="primary"`, `size="compact"` in a row); the rest `secondary` or `outline`.
- On phones a row of pills scrolls sideways and bleeds to the screen edges (`-mx-4 flex gap-2 overflow-x-auto px-4`), wrapping from 640 px (`sm:flex-wrap`): see `portfolio-view.tsx`.
- Destructive actions confirm in a `Dialog` before they run.
- Secondary actions that do not fit go in a `Menu`.
