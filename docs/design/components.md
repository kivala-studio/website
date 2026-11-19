# Components

Every shared component, grouped as in the `/dev/design` gallery. Import primitives from `@/ui/components/*` and `@/ui/icons/icon`; the shared feature pieces from the paths given. Props marked `…` also accept the element's own HTML attributes.

Pick by intent:

| You need | Use | Not |
|---|---|---|
| A group of content with a surface on every width | `Card` | `Panel` |
| A section that is a plain block on phones and a card from 1024 px | `Panel` | `Card` |
| A labelled figure inside a card | `StatTile` (in a `<dl>`) | `StatStrip`, `MarketMetric` |
| Several label/value facts in a sidebar or a strip | `StatStrip` (`grid` or `strip`) | a row of `StatTile`s |
| Switch between panels of one view | `SectionTabs` | `NavTabs` |
| Go to sibling pages, or to URL-filtered views of one list | `NavTabs` | `SectionTabs` |
| Filter one list in place, no URL | `FilterTabs` | `SectionTabs` |
| Pick one of 2–4 values inside a card (Kz/%, gains/declines) | `SegmentedControl` | tabs |
| Pick a chart range | `TimeRangePicker` | a hand-made group |
| Toggle presets or filters inside a form | `chipClass` buttons with `aria-pressed` | `SegmentedControl` |
| A list with columns, sorting or many rows | `DataTable` primitives in a flush card | `CompactRow` |
| A short list in a narrow column | `CompactRow` in a `Panel` or `Card` | a table |
| "See everything" from a card | `SeeAll` in the card's `action` | an accent text link |

## Foundations

### `panel` (utility, `src/app/globals.css`)

The web card surface: `border: 1px solid var(--card-border)`, `rounded-card` (22 px), `bg-card-background`, `shadow-panel`. Use it directly for blocks that are not `Card`s (landing bands, a table card that must be a card on phones too: `<Card flush className="overflow-hidden panel">`). Variants work: `lg:panel`, `desk:panel`.

### `Icon` (`@/ui/icons/icon`)

| Prop | Type | Default | |
|---|---|---|---|
| `name` | `IconName` | | One of the 57 icons in `ICON_PACK` |
| `scale` | `"s" \| "m" \| "l"` | `"m"` | 0.783 em, 1 em, 1.29 em: follows the surrounding font size |
| `label` | `string` | | Accessible name; without it the icon is `aria-hidden` |
| … | SVG attributes | | `className` sets colour (`text-accent`) and size (`text-[1.25rem]`) |

```tsx
<Icon name="alert" scale="l" className="text-accent" />
<Icon name="chart" label={t("unusualActivity.title")} />
```

The pack is generated from `design/icon-pack/masters.json` (the iOS masters plus the web-only `menu`) by `npm run icons`; never edit `icon-pack.ts`. 24 × 24 grid, 2 px round strokes, `currentColor`. Icons are decorative by default: the control around them carries the name.

### `LanguageFlag` (`@/ui/icons/flags`)

`<LanguageFlag locale="pt" />`: the flag that stands for a language, a 20 px disc with a faint inner ring (`primary-text` at 15 %) so its edge holds on either canvas. Portuguese is the flag of Angola, English the Union Jack. Always `aria-hidden`: it sits before the language's name or code, never alone. Flags keep their own colours in both themes, so they are drawn in `flags.tsx` with fixed hex values (like the Google mark), outside the single-colour pack; the only hex values allowed in a component.

## Layout and surfaces (`@/ui/components/layout`)

### `PAGE_CONTAINER`, `READING_COLUMN`

Class strings, not components. See [layout.md](layout.md#the-page-column). `TopBar` puts its row (and its menu panel's content) in `PAGE_CONTAINER` too, so the bar lines up with the page. Page wrappers built on them: `SITE_PAGE`, `ReadingPage`, `MessagePage` (`@/features/site/pages`), `SIGNED_IN_PAGE`, `SignedInPage` (`@/features/shell/placeholder-page`).

### `Card`

The grouping surface. On phones a white (`card-background`) block with 24 px corners and 20 px padding; on `desk:` the web card (`panel`, 24 px padding). With a `title` it renders a `CardHeader` and pads the body under it.

| Prop | Type | Default | |
|---|---|---|---|
| `title` | `ReactNode` | | The card's `h2` |
| `titleId` | `string` | | With `title`, makes the card a `region` labelled by its title |
| `action` | `ReactNode` | | Right of the title: `SeeAll`, a compact pill, a status |
| `flush` | `boolean` | `false` | No body padding: tables and row lists reach the edges |
| `compact` | `boolean` | `false` | 16 px padding |
| `surface` | `"card" \| "elevated"` | `"card"` | `elevated` uses `elevated-background` |
| `bodyClassName` | `string` | | Classes for the body under a title (`flex-1`, `flex flex-col gap-5`) |
| … | `div` attributes | | |

```tsx
<Card title={t("common.yourWatchlist")} titleId="watchlist-title" action={<SeeAll href="/lista" />}>
  <p className="text-body text-secondary-text">…</p>
</Card>

<Card flush className="overflow-hidden panel">
  <DataTable>…</DataTable>
</Card>
```

- Do give every titled card a `titleId` so it is a named region.
- Do put tables in a `flush` card; add `panel` when the table must be a card on phones too.
- Don't nest cards. Inside a card, use `StatTile`, hairline dividers or an inset `bg-app-background` notice.
- Don't add `shadow-*` or `border` classes: the surface is the token.

### `Panel`

A section that is the canvas on phones (iOS stacked sections) and a card from 1024 px (`lg:panel`). Renders a `<section>`; its children are laid out `flex flex-col gap-4`.

| Prop | Type | Default | |
|---|---|---|---|
| `title`, `titleId`, `action` | as `Card` | | `aria-labelledby` the title |
| `always` | `boolean` | `false` | A card on phones too |
| `flush` | `boolean` | `false` | No padding around the content |
| … | `section` attributes | | |

```tsx
<Panel title={t("common.onTheMove")} titleId="home-movement" action={<ButtonLink href="/mercado" kind="outline" size="compact">{t("home.explore.header")}</ButtonLink>}>
  <SegmentedControl … />
  <ul>{/* CompactRow */}</ul>
</Panel>
```

Card vs Panel: use `Card` when the block needs a surface on phones (a figure, a form, a table); use `Panel` for row lists and sections that read better as plain iOS sections on a phone.

### `CardHeader`, `SectionHeader`, `PageHeading`

| Component | Props | Renders |
|---|---|---|
| `CardHeader` | `title`, `titleId?`, `action?`, `className?` | A 44 px row: `h2.text-section` left, the action right. Used by `Card` and `Panel`; use it directly only for a custom card |
| `SectionHeader` | `title: string`, `action?`, `id?` | `h2.text-section` and an action, baseline-aligned, for headings on the canvas outside a card |
| `PageHeading` | `title: string`, `eyebrow?: string` | `<header>` with the page `h1.text-display`; `eyebrow` is a caption above it (only the gallery uses it) |

### `MessageCard`

A one-message page's card: `panel`, at most 448 px, centred, `gap-6`, 24 px padding (32 px from 640 px). Put the page `h1` inside. Prefer `MessagePage` from `@/features/site/pages`, which centres it in the page.

```tsx
<MessagePage title={t("site.notFound.title")}>
  <ButtonLink href="/" className="sm:w-auto">{t("common.home")}</ButtonLink>
</MessagePage>
```

### `StatTile`

A labelled figure inside a card: a hairline box, a muted label over a value in the display face, an optional detail line. Renders `dt`/`dd`, so place tiles in a `<dl>`.

| Prop | Type | Default | |
|---|---|---|---|
| `label` | `ReactNode` | | `dt`; may hold an info button |
| `value` | `ReactNode` | | `dd`; text, a `ChangeBadge`, a `MarketStatusIndicator size="value"` |
| `detail` | `ReactNode` | | A caption `dd` (a date, a source) |
| `size` | `"large" \| "small"` | `"small"` | `large` is the card's lead figure (26 px, 24 on desk) |
| … | `div` attributes | | |

```tsx
<dl className="grid grid-cols-2 gap-3">
  <StatTile size="large" className="col-span-2" label={t("markets.summary.tradedSecurities")} value={format.chartAxis(volume)} />
  <StatTile label={t("markets.summary.transactions")} value={format.count(trades)} />
  <StatTile label={t("markets.summary.verifiedTraded")} value="—" />
</dl>
```

Show "—" for a value that is not usable yet; never a zero.

### `StatStrip`

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ title: string; value: ReactNode; tone?: string }[]` | | `tone` is a text class (`text-positive`) for change values only |
| `variant` | `"strip" \| "grid"` | `"strip"` | `strip`: cells divided by hairlines, two per row on phones, auto-fit from 640 px, values truncate. `grid`: two columns of label over value, no dividers, values wrap (the instrument sidebar's key statistics) |
| `className` | `string` | | |

Use `grid` in narrow columns where values must not truncate; `strip` across a card's width.

## Navigation

### `TopBar` (`@/ui/components/top-bar`)

The one top bar. Use it through `SiteHeader` (`@/features/site/chrome`) or `ShellTopBar` (`@/features/shell/shell-nav`); build a new bar only for a new area.

| Prop | Type | |
|---|---|---|
| `home` | `{ href: string; label: string }` | The logo link and its accessible name |
| `logo` | `ReactNode` | `<BrandLockup />` |
| `nav` | `{ href: string; label: string }[]` | Pill links; the current one (path match) gets `aria-current` and the grey pill |
| `navLabel` | `string` | The `<nav>` name |
| `mobileNav` | `"menu" \| "none"` | Below 1024 px: the links move into a menu behind a button at the start of the bar, before the logo, or nothing (the bottom tab bar has them) |
| `menu` | `{ label: string; content: ReactNode }` | With `"menu"` (required): the button's accessible name (`site.header.menuLabel`) and what follows the links in the menu, under a hairline (`<SiteControls />`) |
| `wideActions` | `ReactNode` | With `"menu"`: actions shown only from 1024 px, before `actions` (the language, `ThemeMenu`); below that they belong in `menu.content` |
| `search` | `ReactNode` | From 1024 px a 288–320 px slot |
| `actions` | `ReactNode` | Icon buttons and one compact pill, right-aligned, at every width |

`TOP_BAR_PILL` is the pill link's class string. Actions are 44 px: `IconButton variant="plain"`, `iconButtonClass("plain")` on links, `LANGUAGE_CONTROL` (a pill: flag and code), `ThemeMenu`, a `size="compact"` pill (the public sign-in pill adds `SIGN_IN_PILL`: below 1024 px it is drawn at 36 px with 12 px padding and an `::after` keeps the 44 px target). The menu button is `iconButtonClass("plain")` (48 px on phones), first in the bar with `-ml-4` so its glyph sits on the gutter; its icon turns from menu to close (`IconSwap`). The current pill's grey fill glides to the new pill on navigation, also across a route change (`useSlidingIndicator` with `memory`).

### `ShellNav` (`@/features/shell/shell-nav`)

The bottom tab bar below 1024 px. Props: `items: { href; label; icon }[]`, `label: string`. Rendered by `AppShell`; pages never render it. The current tab sits on a soft accent capsule that glides to the next tab on navigation; tabs press (`motion-press`); the unread dot grows in and out (`motion-appear`).

### `SectionRail` (`@/ui/components/section-rail`)

A section's own navigation: icon-over-label tiles in a 96 px vertical rail from 1024 px (sticky at `lg:top-20`), a horizontally scrolling strip below. The current tile is raised (`bg-raised shadow-raised`, accent icon) with `aria-current`; the raised fill glides to the next tile on navigation.

| Prop | Type | |
|---|---|---|
| `items` | `RailItem[]` | `{ href; label; icon; exact?; current?: "page" \| "true" \| false; testID? }`. `current` overrides the path match (an overview that owns its detail pages) |
| `label` | `string` | The `<nav>` name |
| `leading` | `ReactNode` | A switcher above the items (beside them on the strip, outside the scroller so its menu is not clipped) |
| `className` | `string` | |

Place it in a `lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8` grid beside the section's page. Style a `leading` control as a tile with `RAIL_TILE` + `RAIL_TILE_IDLE` (see `BookSwitcher` in `portfolio-rail.tsx`: a `Menu` with `triggerClassName`).

```tsx
<SectionRail
  label={t("common.portfolio")}
  items={[
    { href: "/carteira", label: t("assetDetails.tab.overview"), icon: "portfolio", exact: true },
    { href: "/carteira/registos", label: t("common.records"), icon: "history" },
  ]}
/>
```

### Tabs: `SectionTabs`, `NavTabs`, `FilterTabs` (`@/ui/components/controls`)

All three share one look: text tabs in the display face on a hairline, the current one semibold with a 2 px accent underline; idle tabs `secondary-text`. 48 px tall on phones, 44 on desk. The row scrolls sideways when it runs out of width. The underline glides to the new tab (`::after`, `useSlidingIndicator`).

| Component | Semantics | Props |
|---|---|---|
| `SectionTabs` | WAI-ARIA tabs (`tablist`/`tab`, roving focus, arrows, Home, End) | `titles: string[]`, `selected: number`, `onSelect`, `label`, `idPrefix?` (tabs control `${idPrefix}-panel-${i}`; render each panel with `role="tabpanel"`, that id and `aria-labelledby={`${idPrefix}-tab-${i}`}`), `className?` (inset the row inside a flush card: `px-4 desk:px-6`) |
| `NavTabs` | Links in a `<nav>`, the current one `aria-current` | `items: { href; title; exact?; current? }[]`, `label`, `bare?` (no hairline of its own, for a row that draws one under more than the tabs), `linkProps?`, `className?` |
| `FilterTabs` | Toggle buttons with `aria-pressed` in a labelled `group` | `options: { value; title }[]`, `value`, `onChange`, `label`, `testID?` |

```tsx
<SectionTabs titles={[t("assetDetails.tab.overview"), t("common.about")]} selected={tab} onSelect={setTab} label={t("common.security")} idPrefix="instrument" />
<div role="tabpanel" id="instrument-panel-0" aria-labelledby="instrument-tab-0" hidden={tab !== 0}>…</div>
```

- Do use `NavTabs` with `current` when the tabs are URL filters (`/mercado?categoria=…`), so the list works without JavaScript.
- Don't put tabs inside a card for 2–3 short values; use `SegmentedControl`.

`useLinkCurrent()` returns `(href, exact?) => "page" | "true" | undefined` for custom navigation.

### `SeeAll` (`@/ui/components/see-all`)

`<SeeAll href="/lista" />`: the outline compact pill "Ver tudo" for a card header's `action`. One per card.

### Site chrome (`@/features/site/chrome`)

`SiteHeader({ theme })`, `SiteFooter({ year })` (`year`: the request's Luanda year from the layout; see [layout.md](layout.md#footer-sitefooter)), `SiteControls({ theme })` (`ThemeSwitch` and the language link on one row, in the header's menu), `BrandLockup({ wordmarkFrom? })` (mark + wordmark; the wordmark shows from `400` px by default, from `360` in the public bar), `PalancaMark({ className })` (the mark as a mask in `currentColor`), `SIGN_IN_PILL` (extra classes for the header's compact sign-in `ButtonLink`: 36 px drawn, 44 px target below 1024 px; unchanged from 1024 px), `LANGUAGE_CONTROL` (class string of the language link: a 44 px pill with the `LanguageFlag` and the code of the language it switches to, "EN" on Portuguese pages, "PT" on English ones; the accessible name is the language's name).

## Buttons and choices

### `Button`, `ButtonLink` (`@/ui/components/buttons`)

Pills. Phones: full width, 56 px, 17 px semibold (iOS). `desk:`: 44 px, 14 px medium. `size="compact"`: 44 px everywhere, 14 px, sized to the title (card actions, toolbars, the top bar).

| Prop | Type | Default | |
|---|---|---|---|
| `kind` | `"primary" \| "secondary" \| "outline" \| "destructive"` | `"primary"` | Accent fill · grey fill · hairline outline · red tint |
| `size` | `"regular" \| "compact"` | `"regular"` | |
| `icon` | `IconName` | | Leading icon |
| `loading` | `boolean` | `false` | `Button` only: spinner, `aria-busy`, `aria-disabled`, presses ignored, "processing" announced |
| … | `button` attributes / `Link` props | | `type` defaults to `button` |

A regular pill is `w-full`. To size it to its title write `w-auto!` (or `sm:w-auto` from 640 px): `cn` does not merge classes and Tailwind emits `w-full` after `w-auto`.

```tsx
<Button icon="add" onClick={record}>{t("common.recordPurchase")}</Button>
<Button kind="secondary" size="compact" icon="refresh" loading={retrying}>{t("common.tryAgain")}</Button>
<ButtonLink href="/mercado" kind="outline" size="compact">{t("home.explore.header")}</ButtonLink>
```

- One `primary` per view. Everything else is `secondary` or `outline`.
- `destructive` for delete and sign-out confirmations only.
- Disabled pills are at 42 % opacity; prefer `loading` over disabling during a request.
- Pills press (`motion-press`: 98 %, dimmed) and fade between states; the spinner fades in rather than flashing.

`buttonClass(kind?, className?, size?)` gives the same classes for elements that are not `Button`/`ButtonLink`: external links (`StoreButton`), `<summary>`, a server form's submit. It lives in `button-styles.ts`, which server components can import.

### `IconButton`, `iconButtonClass`

Round icon-only button: 48 px on phones, 44 on desk. `label` is required (it is the `aria-label` and the tooltip).

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | `IconName` | | |
| `label` | `string` | | |
| `variant` | `"filled" \| "plain" \| "outline"` | `"filled"` | Grey disc · bare icon with a hover disc (top bar, toolbars, dialog close) · hairline ring |
| … | `button` attributes | | |

When `icon` changes (eye ↔ eye-off), the new glyph grows in. `iconButtonClass(variant?, className?)` styles a link as an icon button (the top bar's activity links). Mark the current one with `aria-current` and `aria-[current=page]:bg-action-surface`.

### `ActionTile`

Icon over a label in a tile (`aria-pressed` toggle; selected: soft accent fill and accent border). Props: `icon`, `title`, `selected?`, button attributes. No page uses it yet.

### `chipClass(selected, className?)` (`button-styles.ts`)

A choice chip: 44 px hairline pill, the chosen one in `accent-soft` with accent text. Use on `<button aria-pressed>` for presets and filters inside forms (alert presets, simulator amounts). The fill is the chosen chip's `::before`, so a single-choice group can glide it with `useSlidingIndicator(value, { selector: '[aria-pressed="true"]' })` on the group (see the gallery's Motion section); idle chips carry `INDICATOR_IDLE` so the fill passes under them.

```tsx
<button type="button" aria-pressed={value === preset} onClick={() => setValue(preset)} className={chipClass(value === preset)}>{label}</button>
```

### `SegmentedControl`, `OptionGroup`, `TimeRangePicker` (`controls.tsx`)

A WAI-ARIA `radiogroup` with roving focus. The segmented look is a `track` groove with the selected segment raised (`SEGMENT_TRACK`, `segmentTone(selected)` in `button-styles.ts`). The raised fill (or the `ranges` pill) glides to the new option.

| Component | Props |
|---|---|
| `SegmentedControl<T>` | `options: { value: T; title; spoken?; disabled?; leading? }[]`, `value`, `onChange`, `label` |
| `OptionGroup<T>` | the same, plus `variant?: "segmented" \| "ranges"` (`ranges`: small pills, the chosen one in `accent-soft`) and `scroll?` (each option keeps 44 px and the track scrolls) |
| `TimeRangePicker` | `value: TimeRange`, `onChange`, `label`, `ranges?` (default `TIME_RANGES`: 1D · 1S · 1M · 3M · 6M · 1A · Tudo), `isEnabled?` (disabled ranges stay visible and inert; arrows skip them), `variant?: "ranges" \| "segmented"` (`segmented` is the chart card's range track) |

```tsx
<SegmentedControl label={t("common.onTheMove")} value={tab} onChange={setTab} options={[{ value: "gains", title: t("home.movers.gainsTab") }, { value: "declines", title: t("home.movers.declinesTab") }]} />
<TimeRangePicker variant="segmented" label={t("components.chart.priceAccessibility")} value={range} onChange={setRange} />
```

`spoken` is the option's accessible name when the title is an abbreviation (`1M` → "One month"). `leading` is a decorative mark before the title: the settings' language choice (`LanguageChoice`) puts each language's `LanguageFlag` there.

### `SwitchRow` (`@/ui/components/menu`)

An on/off switch with its visible label; the whole 44 px row is the target (`role="switch"`). Props: `label`, `checked`, `onChange`, `disabled?`, `testID?`, `children?` (a value line under the label). The thumb slides and the track colour fades.

### `ThemeSwitch`, `ThemeMenu` (`controls.tsx`)

`<ThemeSwitch initial={theme} />` (Sistema · Claro · Escuro as a segmented control, in the public menu) and `<ThemeMenu initial={theme} icon? />` (the same as a check menu, in the top bar). `initial` is the server's `parseTheme(cookie)`. A change cross-fades the whole page (`switchTheme`).

### `Menu` (`@/ui/components/menu`)

A WAI-ARIA menu button. Enter, Space or the arrows open it on the first or last item; arrows, Home and End move; Escape closes it and returns focus; a click outside or Tab closes it. It replaces swipe and long-press actions on the web.

| Prop | Type | Default | |
|---|---|---|---|
| `label` | `string` | | The trigger's name (and the menu's) |
| `entries` | `MenuEntry[]` | | `{ kind: "item", label, icon?, onSelect, destructive?, disabled?, testID? }`, `{ kind: "check", label, checked, onToggle }`, `{ kind: "heading", label }`, `{ kind: "separator" }` |
| `icon` | `IconName` | `"more"` | Icon trigger |
| `trigger` | `ReactNode` | | Visible trigger content: a grey pill instead of the icon |
| `align` | `"start" \| "end"` | `"end"` | |
| `triggerClassName` | `string` | | Replaces the trigger's look (a rail tile) |
| `testID`, `className` | | | |

Menu items show a soft `action-surface` fill on focus instead of the ring. The menu grows from its trigger's corner and shrinks back on close; a check grows in and out.

### `PrivacyModeButton` (`@/features/privacy/privacy-mode`)

The eye `IconButton` that hides or shows personal values in this browser. Place it in the title row of any page with personal figures. Props: `className?`.

## Fields

All text fields share one look: 48 px (44 on desk), 12 px corners on desk, `field-border` on `card-background`. **Focus never shows an outline**: the border turns `accent` and the `shadow-focus` glow appears (mouse and keyboard alike). The base layer removes the outline from every text input, textarea and select; checkboxes, radios, ranges and file pickers keep the ring.

### `field-styles.ts`

| Export | For |
|---|---|
| `INPUT` | A standalone `<input>` or `<select>` (includes `FIELD_FOCUS`) |
| `INPUT_BOX` | A box around a bare input and its prefix or suffix (`Kz`, `%`); lights up with `focus-within` |
| `INPUT_BARE` | The input inside an `INPUT_BOX` |
| `FIELD_FOCUS` | `focus:border-accent focus:shadow-focus`, for a custom element that is itself the field |
| `FIELD_FOCUS_WITHIN` | The same on `focus-within`, for a custom box |

```tsx
<label className="flex flex-col gap-1 text-secondary font-semibold text-primary-text">
  {t("site.auth.email")}
  <input name="email" type="email" className={cn(INPUT, "font-normal")} />
</label>
```

Label every field with a visible `<label>`; placeholders are not labels (except the search field, whose prompt is also its `aria-label`).

### `SearchField` (`controls.tsx`)

The magnifier, the input, then a clear button once there is text or a `KeyHint` chip while empty.

| Prop | Type | |
|---|---|---|
| `value`, `onChange` | `string`, `(value) => void` | |
| `placeholder` | `string` | Defaults to "Pesquisar títulos ou emitentes"; also the `aria-label` |
| `name` | `string` | So the field works in a plain GET form without JavaScript |
| `controls` | `string` | Id of the results it filters |
| `hint` | `string` | A shortcut chip (`/`) |
| `autoFocus`, `onKeyDown`, `className` | | `className` sizes the box (the landing's taller field) |

Wrap it in `<form role="search" action=… method="get">` when the results page reads the query from the URL. `FIELD` is its box class (shared with the command palette's button); `KeyHint` the chip.

### `AmountField` (`@/ui/components/amount-field`)

Decimal amounts: comma decimal separator in every language (`.` typed as `,`), live thousands grouping, the caret kept on the same digit, invalid keystrokes rejected, completed on blur. Parse the text with `parseAmount` into a `Decimal`.

| Prop | Type | |
|---|---|---|
| `value` | `string` | The field's text |
| `onValueChange` | `(text: string) => void` | |
| `prefix`, `suffix` | `ReactNode` | E.g. a minus sign, `Kz` |
| `boxClassName` | `string` | Classes for the `INPUT_BOX` |
| … | `input` attributes | `id`, `aria-*`, `onBlur` |

## Data display

### Table primitives (`@/ui/components/table`)

60 px rows divided by hairlines, no zebra, a muted 14 px header in Inter, cells in the display face, numeric columns right-aligned, a faint hover that deepens while a row link is pressed. The first and last cells carry the card's inset (16 px, 24 on desk).

| Component | Props |
|---|---|
| `DataTable` | `table` attributes (`className="table-fixed"` with fixed numeric widths) |
| `TableHead` | `children` (header cells), `className?`: one header row with a hairline under it |
| `TableHeaderCell` | `align?: "left" \| "right" \| "center"`, `th` attributes (`scope="col"`) |
| `TableSortHeader` | `label`, `sort: "ascending" \| "descending" \| undefined`, `href` (the URL with the new sort), `align?`, `className?`: the label is a link; the sorted column has `aria-sort`, primary text and an arrow that grows in and turns with the direction |
| `TableRow` | `tr` attributes |
| `TableCell` | `numeric?` (right-aligned, no wrap), `td` attributes |
| `TableNameCell` | `logo?`, `name`, `symbol?` (a muted "• SYM"), `href?` (the whole row becomes the link through an overlay that carries the focus ring), `linkProps?`, `stackOnPhone?` (symbol under the name below 640 px), `detail?` (a caption line under the name), `className?`. Renders `th scope="row"` |

`TABLE_HEADER_CELL`, `TABLE_ROW`, `TABLE_CELL` are the class strings for custom cells.

```tsx
<Card flush className="overflow-hidden panel">
  <DataTable className="table-fixed">
    <TableHead>
      <TableSortHeader label={t("common.instrument")} sort={ariaSort("name")} href={sortLink("name")} />
      <TableSortHeader label={t("common.price")} sort={ariaSort("price")} href={sortLink("price")} align="right" className="w-36 sm:w-44" />
    </TableHead>
    <tbody>
      <TableRow>
        <TableNameCell logo={<SecurityLogo symbol="BAI" size="s" />} name="Banco Angolano de Investimentos" symbol="BAI" href="/mercado/BAI" stackOnPhone />
        <TableCell numeric><PriceCell row={row} security={live} at={at} /></TableCell>
      </TableRow>
    </tbody>
  </DataTable>
</Card>
```

- Row actions go in the last cell with `relative z-10`, above the row link.
- To glide rows on a sort, render the body as `<FlipList as="tbody">` with `data-flip-key` on each `TableRow`.
- Fold columns on phones instead of scrolling ([layout.md](layout.md#tables-on-phones)).

### `CompactRow`, `MoverRow` (`@/features/market/browse/market-overview`)

`CompactRow({ security, row, children, className? })`: an `<li>` whose whole 48 px row (44 on desk) links to the instrument: logo (hidden below 400 px), symbol, then `children` (the trailing figures). Put rows in a `<ul>` in a `Panel` or `Card`. `MoverRow({ security, row, at, volume, className? })` is a `CompactRow` with the price (or traded volume) and the change. Use them for short lists in narrow columns; use a table when there are columns to compare.

### `PriceCell`, `ChangeCell`, `rowFigure` (`@/features/market/browse/price-cell`)

The only way a list shows a price. `rowFigure(row, security, at)` decides: a current price once the store has assessed the quote as usable, otherwise the server's dated verified close, otherwise nothing.

| Component | Props | Shows |
|---|---|---|
| `PriceCell` | `row: CatalogueRow \| undefined`, `security: MarketSecurity \| undefined`, `at: number \| undefined`, `inlineChange?` (classes for the badge under a current price), `compact?` (14 px), `className?` | Current: the price and its change badge. Close: the price and its date (read as "Último fecho verificado · date"). None: "Preço por confirmar" |
| `ChangeCell` | `row`, `security`, `at` | The change badge, or a muted "—" |

Pass `security={undefined}` and `at={undefined}` on cached pages (the landing): they show the dated close only.

### `FinancialValue` (`@/ui/components/financial`)

A formatted instrument value in the display face, always `primary-text`. When the value changes it rolls in: up when it rises, down when it falls (`AnimatedText`); nothing plays on load.

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `Numeric` (`Decimal`, decimal string or number) | | |
| `style` | `"display" \| "price" \| "standard"` | `"standard"` | `text-headline` · `text-price` · 17/16 px medium |
| `bond` | `boolean` | `false` | Bond prices format as a percentage of nominal |
| `code` | `string` | `"AOA"` | Currency |
| `digits` | `number` | | Fraction digits |
| `className` | `string` | | |

### `ChangeBadge`

`<ChangeBadge value={change} />`: a signed percentage capsule with an arrow, in the gain/loss colour with a 12 % tint; zero is grey. Read as "Variação: Subiu 2,14 %". 28 px tall on phones, 24 on desk. Props: `value: Numeric`, `className?`. The figure rolls and the tint fades when the value changes.

### `MarketStatusIndicator`

A status dot and its word (Aberto, Fechado, Em breve, Indisponível), read as "Mercado …". Props: `status: "unknown" | "closed" | "openingSoon" | "open"`, `size?: "caption" | "value"` (`value` sets it as a `StatTile`'s figure).

### `MarketMetric`

Label, value and an optional caption and icon, "—" when the value is `null`. Props: `title`, `value: string | null`, `detail?`, `icon?`. No page uses it yet; prefer `StatTile`.

### `SecurityLogo` (`@/ui/components/rows`)

Circular issuer logo; a coloured monogram when there is no image or it fails. Decorative (`aria-hidden`): the row names the instrument. The circle is white with a hairline edge in both themes.

The component reads each logo once in a small canvas (same-origin, so allowed) and picks its fit, cached per URL for the page:

| Logo | Fit |
|---|---|
| Near-square, opaque to its edges, not mostly white (a solid badge) | Fills the circle (`object-cover`), clipped round |
| The same with a thin white strip on an edge (a loosely cropped favicon) | Fills it enlarged 10 %, so the strip falls outside |
| Transparent edges, a wide wordmark, a mark on white, or anything the canvas can't read | Contained with 12 % padding on the white |

The image stays transparent until its fit is known, then fades in, so it never jumps between fits; without scripting it shows contained.

Logos come only from the site's origin, so `img-src` stays `'self'`: `issuerLogoURL(issuerID)` (`@/data/market/logos`) gives `/api/logos/{issuer}` (nothing in demo mode), and market rows, catalogue rows and the instrument and admission pages already carry it as `logoURL`. The route resolves the issuer's curated `logo_url`, else the Google favicon of its `website_url` (`resolvedLogoURL`, as iOS), fetches it on the server (HTTPS, 4 s, 512 KB, PNG, JPEG, WebP, GIF or ICO; never SVG) and answers it with a day of CDN caching, or a 404 cached for an hour, which shows the monogram. Never pass a third-party URL.

| Prop | Type | Default | |
|---|---|---|---|
| `symbol` | `string` | | Monogram: up to four characters, hyphens dropped |
| `logoUrl` | `string \| null` | | A same-origin `/api/logos/{issuer}` path (`logoURL` on rows) |
| `brandColor` | `"blue" \| "gold" \| "green" \| "red" \| "violet"` | `"blue"` | Pages use `violet` for bonds and `blue` otherwise |
| `size` | `"s" \| "m" \| "l" \| "header"` | `"m"` | 32 px · 48/36 desk · 64/48 desk · 48 px everywhere |

### `AssetRow`, `FeatureRow` (`rows.tsx`)

`AssetRow({ symbol, name, price: Numeric | null, change?, bond?, code?, logoUrl?, brandColor?, href? })`: the iOS instrument row (logo, symbol over name, price over change badge, or "Preço por confirmar" when `price` is null); stacks below 320 px. Used in the market information list. `FeatureRow({ icon, title, subtitle })`: an icon tile beside a title and a line; no page uses it yet.

## Motion (`@/ui/components/motion`, `@/ui/motion`)

The patterns and when to use each are in [theme.md](theme.md#motion); the Motion section of `/dev/design` shows them all.

| Piece | Props | |
|---|---|---|
| `IconSwap` | `icons: [IconName, IconName]`, `show: 0 \| 1`, `turn?`, `scale?`, `className?` | Two icons in one place, the shown one growing in as the other shrinks away; `turn` adds a quarter turn (menu ↔ close). Decorative; server-safe |
| `Collapse` | `open`, `children`, `className?` (the inner box), `div` attributes (`id`) | A region that grows open and folds closed; closed, it is inert. Pair it with a button with `aria-expanded` and `aria-controls`. Server-safe. For `<details>`, add `motion-details` (and `group` + `motion-turn group-open:rotate-180` on the chevron) |
| `AnimatedText` (`@/ui/components/animated-value`) | `text`, `numeric?` (the raw value as a string, for the direction), `live?`, `className?` | A figure that rolls when it changes. `live` (a current quote; `FinancialValue live`): a tint of the direction fades out behind it as well, through `playLive` |
| `Meter` (`@/ui/components/meter`) | `value` (0–100), `label`, `className?` | A share as a thin accent bar on the track (`role="meter"`): it grows or shrinks from where it was. An SVG rect sized by its attribute: no inline width |
| `FadeIn` (`@/ui/components/states`) | `rise?`, `div` attributes | Content replacing a skeleton or another state: fades (`rise`: and rises) in when mounted after hydration, simply there when the server rendered it. Key it to replay on a swap |
| `FlipList` (`@/ui/components/flip-list`) | `as?: "ul" \| "ol" \| "tbody" \| "div"`, list attributes; each item a direct child with `data-flip-key` | Items glide to their new places on a sort or reorder; new items fade in. Lists of more than 60 moving items just change |
| `INDICATOR_FILL`, `INDICATOR_IDLE` (`button-styles.ts`) | | The selected item draws its fill as `before:` (add `before:bg-…`); idle items keep their labels above a passing fill |
| `useSlidingIndicator(selection, { selector, pseudo?, memory? })` | | On a group: glides the selected item's `::before` (or `::after`) from the previous selection. `memory` (a stable key) keeps the place across a route change that renders the group again |
| `usePresence(open, { timeout? })` | | `{ mounted, state, presenceProps }` for anything with an exit: render while `mounted`, spread `presenceProps` on the element with `motion-pop` (or a utility keyed on `data-state="closing"`) |
| `usePresenceValue(value, { timeout? })` | | `{ value, open, key }` for a dialog that shows a value: `{shown.value ? <Details key={shown.key} open={shown.open} item={shown.value} /> : null}`. The dialog leaves with its content, then unmounts; each opening is a fresh mount. Pass a stable value or a boolean |
| `useChangeAnimation(ref, value, animation, isSame?, schedule?)` | | Plays one or more Web Animations when `value` changes, never on mount; `valueRoll`, `valueFlash`, `barGrow`, `stepSlide`, `ICON_IN`, `FADE_IN`. `schedule`: `playLive` for figures a poll changes |
| `useChartMotion(plot, ghost, key, { draw })` | | A chart's line wiping in once (`draw`: mounted after hydration) and cross-fading to another series. `plot`: the group React draws into; `ghost`: an empty group after it; `key`: the drawn content as a string |
| `PageTransition` (`@/ui/motion/page-transition`) | `children` | The page dissolve on navigation (React `<ViewTransition exit>`). Already in each route group's `template.tsx` and layout; nothing else uses it |
| `crossFadePage(update)` | | Runs a page-wide change of figures (privacy mode) inside a View Transition cross-fade |
| `useEntrance()` | | `true` when the component mounted after hydration: only then add an entrance class |
| `switchTheme(update)` | | Runs a theme change inside a View Transition cross-fade |

## Overlays

### `Dialog` (`@/ui/components/dialog`)

A modal on `<dialog>`: focus is trapped, Escape and a backdrop click close it, focus returns to the opener. Opening focuses the close button, or a descendant marked `data-autofocus`. The title is the dialog's `h2` and its name.

| Prop | Type | Default | |
|---|---|---|---|
| `open`, `onClose` | `boolean`, `() => void` | | |
| `title` | `string` | | |
| `variant` | `"sheet" \| "dialog"` | `"sheet"` | `sheet`: a bottom sheet on phones, a 448 px side panel from 768 px. `dialog`: a centred window, 512 px max |
| `footer` | `ReactNode` | | A persistent bottom area above a hairline for the primary action |
| `children` | `ReactNode` | | Padded body that scrolls |

```tsx
<Dialog open={open} onClose={() => setOpen(false)} title={t("common.hiddenValues")} variant="dialog" footer={<Button onClick={() => setOpen(false)}>{t("common.ok")}</Button>}>
  <p className="text-body">…</p>
</Dialog>
```

Use `sheet` for tasks and long content (forms, alerts, methodology), `dialog` for a short confirmation or explanation. The body is already padded; don't add horizontal padding inside.

A sheet slides in from the bottom (from the right at 768 px and up), a dialog rises and grows; both leave the same way and the backdrop fades. Keep `Dialog` mounted and drive `open`: a dialog rendered only while open has no exit.

## Feedback (`@/ui/components/feedback`)

| Component | Props | |
|---|---|---|
| `ToastHost` | `children` | Wrap the tree once; one toast at a time from the top, announced politely, auto-dismissed after 7 s unless it has a retry; it slides in and lifts away, and a new toast replaces the shown one in the same place |
| `useToast()` | | `{ show(toast), dismiss() }`; `toast: { title, message, actionTitle?, onRetry?, onDismiss? }` |
| `OfflineBanner` | `forceVisible?` | "Sem ligação à Internet" while offline (`role="status"`). Put it first on pages that show market data; it fades and rises in when the connection drops |
| `useOnline()` | | `navigator.onLine` as state |
| `HiddenValue` | `className?` | Six dots for a personal value, read as "Valor oculto"; the value is not in the page |
| `SensitiveValue` | `hidden`, `children`, `className?` | Masks a value but keeps its footprint (the value stays in the DOM, inert). No page uses it yet |

`Private({ children, className? })` in `@/features/portfolio/portfolio-ui` renders the text or, in privacy mode, `HiddenValue`: use it for every personal figure.

## States (`@/ui/components/states`)

| Component | Props | Use |
|---|---|---|
| `Spinner` | `className?` | 1 em ring in `currentColor`; inside buttons and `LoadingState`. Fades in as it starts |
| `LoadingState` | `message?` | A whole view loading (`role="status"`) |
| `EmptyState` | `title`, `message?`, `icon?` (`"info"`), `action?` | Nothing to show; offer the next step as the action |
| `ErrorState` | `title?` ("Dados indisponíveis"), `message`, `action?` | A view failed (`role="alert"`); the action is "Tentar novamente" |
| `Skeleton` | `className` | A grey pulsing block shaped like what will load |
| `InstrumentRowSkeleton` | | Placeholder for an instrument row |
| `ChartShimmer` | `className?` | A chart's place while it loads; never fake data |
| `SectionPlaceholder` | `title`, `failed?`, `onRetry?` | A section keeps its place while loading or after it fails |

`LoadingState`, `EmptyState`, `ErrorState` and a failed `SectionPlaceholder` fade in when they replace content after hydration; rendered by the server, they are simply there. Content that replaces a skeleton fades in with `motion-fade-in` when `useEntrance()` is true.

## Settings rows (`@/features/settings/settings-ui`)

`SettingsGroup({ id, title, children, className? })`: a titled `Card` whose rows are divided by hairlines. Rows: `LinkRow({ href, icon?, label, value?, external? })` (chevron or external arrow), `ValueRow({ icon?, label, children })`, `ControlRow({ icon?, label, children })` (the control under the label on phones, beside it from 640 px), `DisclosureRow({ icon?, label, children })` (an expandable `<details>` that grows open and folds closed, its chevron turning). All work without JavaScript.

## Landing pieces (`@/features/site/home`, `@/features/site/visuals`)

Landing-only building blocks; reuse them for new marketing sections, not for app pages.

| Export | |
|---|---|
| `HOME_SECTION`, `HOME_HEADING` | Section spacing (`py-16 md:py-24`) and the large centred section title (40 px from 1024 px) |
| `HERO_TITLE` | The hero `h1`: display face, balanced, −0.02em (−0.025em from 640 px). Phones: fluid 38 → 44 px (42 px at 390, two lines), leading 1.08; from 640 px fluid 47 → 68 px, leading 1.04 |
| `CLOSING_TITLE` | The closing line's `h2`: the same face and tracking, fluid 34 → 56 px (between `HOME_HEADING` and `HERO_TITLE`) |
| `HeroBackdrop` | `{ edge? }`: decorative accent glow (`hero-glow`) over a fine grid (`hero-grid`); first child of a `relative isolate overflow-hidden` block. `edge="bottom"` mirrors it so the light rises from the block's bottom edge (the landing's close, onto the footer hairline) |
| `HeroFigures` | `{ total?, items: { value; label }[], className? }`: a `<dl>` of real catalogue counts (display face). Phones: `items` only, as an even row of equal columns between hairlines, each 22 px count above its caption label (11 px at 360 px and below); `total` is hidden. From 640 px: one inline strip, `total` first, each count beside its label |
| `Showcase` | Centres the product under the hero (max 1024 px) on an accent halo (`showcase-halo`) behind and around it, in a translucent bezel from 640 px |
| `MarketPreview` (`@/features/site/home-client`) | `{ tabs, label }`: one flush card with `SectionTabs` on top, a table of dated verified closes per kind and that kind's "Ver tudo" pill in the footer |
| `Bento` | The "all in one" grid: a `<figure>` with a `<ul>` of `BentoCard`s (6 columns from 1024 px, 2 from 768 px, 1 on phones) and one "Exemplo ilustrativo" caption for the whole grid |
| `BentoCard` | `{ href, title, wide?, wash?, bleed?, children }`: a whole-card `Link` (`prefetch={false}`, focus ring, `motion-press`, border to `field-border` and a 1 px lift on hover (the `motion-lift` timing), no lift with reduced motion; a scroll-reveal target) holding a `panel` with the title (the link's name) and the miniature in an `aria-hidden`, unselectable frame that bleeds off the bottom under a fade (`bleed="corner"`: the right edge too). `wide` spans 4 of 6 columns (the whole row at 768 px); `wash` adds the accent light (`bento-wash`), for the largest card only |
| `SimulatorMiniature`, `UnusualActivityMiniature`, `NewsMiniature`, `LearnMiniature`, `WeekAheadMiniature` (`@/features/site/visuals`) | A few rows of `/simulador`, `/atividade-invulgar`, `/noticias`, `/aprender` and `/semana` at small size, built from the real pieces (`SecurityLogo`, chips, lesson icons, the simulator's projected and invested lines); sample values and catalogue wording only, no controls |
| `FeatureRows` | The feature rows' column: `PAGE_CONTAINER`, 64 px between rows and above them (96 px from 768 px); Plus's own top padding gives the same space below |
| `FeatureRow` | `{ id, icon, title, message, action, visual, flip? }`: the icon in a 48 px `accent-soft` squircle, the `h2` (`HOME_HEADING`), the message and the action, then the visual. Stacked, text first, below 1024 px; from there two columns, the visual taking 7 of 12 on the left (on the right with `flip`), the text vertically centred. Marks the row `data-flip` so the visual's floating card leans towards the text, and `data-reveal="stagger"` so the text eases in before the visual |
| `InstrumentVisual`, `WatchlistVisual`, `PortfolioVisual` | Product visuals on a tinted stage (`feature-stage`, hairline border, `rounded-card`): a main card the stage's width and a smaller floating card (`border-field-border`, above it) that overlaps it and leans out by the stage's `--lean` (24 px from 640 px, 32 px from 1024 px) towards the text. Instrument: price, change, range track and a month's line under the opening and high (the high alone below 368 px); watchlist: a reached price alert over three rows of `/lista`; portfolio: the `/carteira` value, change and line under the allocation. Charts are SVG: an area fading to transparent, round caps, dashed grid, a dot with a soft halo on the last point; on reveal the line wipes in from the left, then the area and dot fade in. On hover the stage's border turns `field-border` and the floating card rises 4 px. `{ label }` is the figure's accessible name; captioned "Exemplo ilustrativo" (`IllustrativeCaption`, `onboarding.preview.illustrativeExample`) |
| `PlusVisual` | `{ label }`: what Plus adds, with no stage of its own (it sits on the Plus panel's light): a "Movimento relevante" notice (the activity centre's movements tint, `ChangeBadge`) lifted over a comparison card as in the instrument page's "Comparar" sheet (range track, one line per instrument from a shared start in `accent` and `brand-violet`, each instrument's `SecurityLogo`, line colour and change). From 1024 px the notice leans 32 px towards the text. Captioned "Exemplo ilustrativo" |
| `StoreButton` | The App Store pill; `kind?`, `className?` |
| `Reveal` (`@/features/site/reveal`) | The landing's scroll reveal, a client component that renders nothing: after mount it gives each `[data-reveal]` target still wholly below the fold its start state and eases it in once as it enters the viewport (an `IntersectionObserver`; utilities in `motion.css`, see [theme.md](theme.md#motion)). Targets: the bento heading, each `BentoCard`, each `FeatureRow` (`stagger`: text, then the visual), the Plus panel and the closing band (`stagger`). Mount it once per page |

See [patterns.md](patterns.md#illustrative-visuals) for the visuals rule.
