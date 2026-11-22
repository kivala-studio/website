"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useRef, useSyncExternalStore } from "react";

import { Link, useDestinationPathname } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { switchTheme } from "../motion/theme-transition";
import { useEntrance } from "../motion/use-entrance";
import { useSlidingIndicator } from "../motion/use-sliding-indicator";
import { parseTheme, THEME_COOKIE, type Theme, THEMES } from "../theme/theme";
import { INDICATOR_FILL, INDICATOR_IDLE, SEGMENT_TRACK, segmentTone } from "./button-styles";
import { FIELD_FOCUS_WITHIN } from "./field-styles";
import { Menu } from "./menu";

/** Arrow, Home and End keys move between options and select them (WAI-ARIA tabs and radio groups). */
function useRovingKeys(
  count: number,
  selected: number,
  onSelect: (index: number) => void,
  isEnabled: (index: number) => boolean = () => true,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: number | undefined;
    if (step) {
      next = selected;
      do next = (next + step + count) % count;
      while (!isEnabled(next) && next !== selected);
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === undefined || !isEnabled(next)) return;
    event.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
}

/**
 * The page-level tab look (CoinStats): text tabs on a hairline, the current one bold with a 2 px accent underline.
 * The underline is the current tab's `::after`; `useSlidingIndicator` glides it to the next tab.
 */
const TAB_ROW = "flex gap-6";
const TAB_LIST = cn(TAB_ROW, "overflow-x-auto border-b border-hairline [scrollbar-width:none]");
const TAB = "relative inline-flex min-h-12 shrink-0 items-center font-display text-body transition-colors desk:min-h-11";
const TAB_CURRENT = "font-semibold text-primary-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent";
const TAB_OTHER = "font-medium text-secondary-text hover:text-primary-text";

/** Text tabs that switch panels in place (WAI-ARIA tabs); the selected tab has weight and an accent underline. */
export function SectionTabs({
  titles,
  selected,
  onSelect,
  label,
  idPrefix,
  className,
}: {
  titles: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
  label: string;
  /** Tabs control panels with ids `${idPrefix}-panel-${index}`. */
  idPrefix?: string;
  className?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(titles.length, selected, onSelect);
  const list = useSlidingIndicator<HTMLDivElement>(selected, { selector: '[aria-selected="true"]', pseudo: "::after" });
  return (
    <div ref={list} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn(TAB_LIST, className)}>
      {titles.map((title, index) => (
        <button
          key={title}
          ref={(node) => { refs.current[index] = node; }}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${index}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel-${index}` : undefined}
          aria-selected={index === selected}
          tabIndex={index === selected ? 0 : -1}
          onClick={() => onSelect(index)}
          className={cn(TAB, index === selected ? TAB_CURRENT : TAB_OTHER)}
        >
          {title}
        </button>
      ))}
    </div>
  );
}

/**
 * Text tabs that filter one list in place without panels of their own (category filters): toggle buttons with
 * `aria-pressed` in a labelled group, in the underline tab look.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: readonly { value: T; title: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Test id on each button. */
  testID?: string;
}) {
  const group = useSlidingIndicator<HTMLDivElement>(value, { selector: '[aria-pressed="true"]', pseudo: "::after" });
  return (
    <div ref={group} role="group" aria-label={label} className={TAB_LIST}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(TAB, option.value === value ? TAB_CURRENT : TAB_OTHER)}
          data-testid={testID}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}

/** Whether `href` is the current page or a section above it (`/carteira` on `/carteira/registos`). */
export function useLinkCurrent(): (href: string, exact?: boolean) => "page" | "true" | undefined {
  // The destination while a link's page is on its way, so the pressed item is current at once.
  const pathname = useDestinationPathname();
  return (href, exact = false) =>
    pathname === href ? "page" : !exact && href !== "/" && pathname.startsWith(`${href}/`) ? "true" : undefined;
}

type NavTab = {
  href: ComponentProps<typeof Link>["href"];
  title: string;
  /** Current only on its own path (a section's overview). */
  exact?: boolean;
  /** Overrides the path match, for tabs that are filters on one page (`?categoria=…`). */
  current?: boolean;
  /** Filters a list the browser already holds: change the URL in place instead of loading the page again. */
  onNavigate?: ComponentProps<typeof Link>["onNavigate"];
};

/**
 * Text tabs that are links to sibling pages (page-level sections) or to filtered views of one page. The current one
 * carries `aria-current`. `bare` drops the list's own hairline, for a tab row that draws one under more than the tabs.
 * The underline glides to the new tab, also when a route change renders the tabs again (remembered by `label`).
 */
export function NavTabs({
  items,
  label,
  bare = false,
  linkProps,
  className,
}: {
  items: readonly NavTab[];
  label: string;
  bare?: boolean;
  linkProps?: Omit<ComponentProps<typeof Link>, "href" | "className" | "children" | "aria-current">;
  className?: string;
}) {
  const current = useLinkCurrent();
  const states = items.map((item) =>
    item.current !== undefined ? (item.current ? "true" : undefined) : typeof item.href === "string" ? current(item.href, item.exact) : undefined,
  );
  const list = useSlidingIndicator<HTMLUListElement>(states.join(), { selector: "[aria-current]", pseudo: "::after", memory: `tabs:${label}` });
  return (
    <nav aria-label={label} className={className}>
      <ul ref={list} className={bare ? TAB_ROW : TAB_LIST}>
        {items.map((item, index) => {
          const state = states[index];
          return (
            <li key={item.title} className="flex shrink-0">
              <Link {...linkProps} href={item.href} onNavigate={item.onNavigate ?? linkProps?.onNavigate} aria-current={state} className={cn(TAB, state ? TAB_CURRENT : TAB_OTHER)}>
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** `leading`: a decorative mark before the title (a language's flag). `trailing`: a small badge after it (a saving); say it in `spoken` too. */
type Option<T extends string> = { value: T; title: string; spoken?: string; disabled?: boolean; leading?: ReactNode; trailing?: ReactNode };

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "segmented",
  scroll = false,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "segmented" | "ranges";
  /** A segmented track with many short options (time ranges): each keeps a 44 px target and the track scrolls when it runs out of width. */
  scroll?: boolean;
}) {
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const { refs, onKeyDown } = useRovingKeys(
    options.length,
    selected,
    (index) => onChange(options[index].value),
    (index) => !options[index].disabled,
  );
  // The selected fill (the raised segment, the soft range pill) glides from option to option.
  const group = useSlidingIndicator<HTMLDivElement>(selected, { selector: '[aria-checked="true"]' });
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        variant === "segmented" ? SEGMENT_TRACK : "flex gap-1 overflow-x-auto p-1 [scrollbar-width:none]",
        scroll && "overflow-x-auto [scrollbar-width:none]",
      )}
    >
      {options.map((option, index) => {
        const isSelected = index === selected;
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.spoken}
            aria-disabled={option.disabled || undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => !option.disabled && !isSelected && onChange(option.value)}
            className={cn(
              "motion-press min-h-11 px-2 aria-disabled:opacity-42",
              variant === "segmented"
                ? cn("flex-1 rounded-small text-secondary font-semibold desk:rounded-[0.5rem] desk:font-medium", scroll && "min-w-11 shrink-0", segmentTone(isSelected), !isSelected && "hover:text-primary-text")
                : cn(
                    "min-w-11 shrink-0 rounded-full text-caption font-semibold",
                    isSelected ? cn(INDICATOR_FILL, "text-accent before:bg-accent-soft") : cn(INDICATOR_IDLE, "text-secondary-text hover:text-primary-text"),
                  ),
            )}
          >
            {option.leading || option.trailing ? (
              <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                {option.leading}
                {option.title}
                {option.trailing}
              </span>
            ) : (
              option.title
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>(props: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return <OptionGroup {...props} variant="segmented" />;
}

export const TIME_RANGES = ["oneDay", "oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear", "all"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

/**
 * Range chips `1D · 1S · 1M · 3M · 6M · 1A · Tudo`; disabled ranges stay visible but inert. `segmented` puts them on
 * a segmented track (a chart card's range control).
 */
export function TimeRangePicker({
  value,
  onChange,
  ranges = TIME_RANGES,
  isEnabled = () => true,
  label,
  variant = "ranges",
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  ranges?: readonly TimeRange[];
  isEnabled?: (range: TimeRange) => boolean;
  label: string;
  variant?: "ranges" | "segmented";
}) {
  const t = useTranslations();
  const options = [...new Set(ranges)].map((range) => ({
    value: range,
    title: range === "all" ? t("common.all") : t(`market.range.${range}`),
    spoken: t(`components.range.${range}Accessibility`),
    disabled: !isEnabled(range),
  }));
  return <OptionGroup options={options} value={value} onChange={onChange} label={label} variant={variant} scroll={variant === "segmented"} />;
}

/** The search field look: 44 px, 12 px corners, a hairline border, the magnifier first. Shared with the palette button. */
export const FIELD =
  "flex min-h-12 items-center gap-2 rounded-medium border border-field-border bg-card-background pl-4 pr-1 text-secondary-text transition-[border-color,box-shadow] desk:min-h-11 desk:pl-3";

/** The keyboard hint chip at the end of a search field (`/`). */
export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd aria-hidden className="mr-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-[0.375rem] bg-action-surface px-1.5 font-sans text-caption font-medium text-secondary-text">
      {children}
    </kbd>
  );
}

/** Search field with a clear button. */
export function SearchField({
  value,
  onChange,
  placeholder,
  name,
  autoFocus,
  onKeyDown,
  controls,
  hint,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Form field name, so the search also works as a plain GET form without JavaScript. */
  name?: string;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Id of the results this field filters. */
  controls?: string;
  /** A keyboard shortcut chip shown while the field is empty (`/`). */
  hint?: string;
  /** Size or surface overrides for the field box (a taller hero field). */
  className?: string;
}) {
  const t = useTranslations("designSystem.search");
  const input = useRef<HTMLInputElement>(null);
  const prompt = placeholder ?? t("prompt");
  return (
    <div className={cn(FIELD, FIELD_FOCUS_WITHIN, className)}>
      <Icon name="search" />
      <input
        ref={input}
        type="search"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        aria-controls={controls}
        placeholder={prompt}
        aria-label={prompt}
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent py-3 desk:py-2 text-body text-primary-text placeholder:text-secondary-text"
      />
      {value ? (
        <ClearButton
          label={t("clearAccessibility")}
          onClear={() => {
            onChange("");
            input.current?.focus();
          }}
        />
      ) : hint ? (
        <KeyHint>{hint}</KeyHint>
      ) : null}
    </div>
  );
}

/** The search field's clear button: it grows in when typing starts (not when the page loads with a query). */
function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  const entrance = useEntrance();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClear}
      className={cn("motion-press flex size-11 items-center justify-center rounded-full hover:text-primary-text", entrance && "motion-fade-in")}
    >
      <Icon name="close" scale="s" />
    </button>
  );
}

/** The chosen theme, shared by every theme control on the page. Saved in a cookie so the server renders it next time. */
const THEME_EVENT = "investao:theme";
const subscribeTheme = (listener: () => void) => {
  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
};

function useTheme(initial: Theme): [Theme, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, () => parseTheme(document.documentElement.dataset.theme), () => initial);
  const set = (next: Theme) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // One cross-fade of the whole page where the browser can (instant otherwise).
    switchTheme(() => {
      document.documentElement.dataset.theme = next;
      window.dispatchEvent(new Event(THEME_EVENT));
    });
  };
  return [theme, set];
}

/** Sistema / Claro / Escuro as a segmented control. */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const t = useTranslations();
  const [theme, setTheme] = useTheme(initial);
  return (
    <SegmentedControl
      label={t("common.theme")}
      value={theme}
      onChange={setTheme}
      options={THEMES.map((value) => ({ value, title: t(`designSystem.appearance.${value}`) }))}
    />
  );
}

/** The same choice as a compact icon menu (top bar). */
export function ThemeMenu({ initial, icon = "settings", triggerClassName }: { initial: Theme; icon?: IconName; triggerClassName?: string }) {
  const t = useTranslations();
  const [theme, setTheme] = useTheme(initial);
  return (
    <Menu
      label={t("common.theme")}
      icon={icon}
      triggerClassName={triggerClassName}
      entries={THEMES.map((value) => ({
        kind: "check" as const,
        label: t(`designSystem.appearance.${value}`),
        checked: theme === value,
        onToggle: () => setTheme(value),
      }))}
    />
  );
}
