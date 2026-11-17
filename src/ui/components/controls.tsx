"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, type ReactNode, useRef, useSyncExternalStore } from "react";

import { Link, usePathname } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { parseTheme, THEME_COOKIE, type Theme, THEMES } from "../theme/theme";
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

/** The page-level tab look (CoinStats): text tabs on a hairline, the current one bold with a 2 px accent underline. */
const TAB_LIST = "flex gap-6 overflow-x-auto border-b border-hairline [scrollbar-width:none]";
const TAB = "relative inline-flex min-h-12 shrink-0 items-center font-display text-body desk:min-h-11";
const TAB_CURRENT = "font-semibold text-primary-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent";
const TAB_OTHER = "font-medium text-secondary-text hover:text-primary-text";

/** Text tabs that switch panels in place (WAI-ARIA tabs); the selected tab has weight and an accent underline. */
export function SectionTabs({
  titles,
  selected,
  onSelect,
  label,
  idPrefix,
}: {
  titles: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
  label: string;
  /** Tabs control panels with ids `${idPrefix}-panel-${index}`. */
  idPrefix?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(titles.length, selected, onSelect);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={TAB_LIST}>
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

/** Whether `href` is the current page or a section above it (`/carteira` on `/carteira/registos`). */
export function useLinkCurrent(): (href: string, exact?: boolean) => "page" | "true" | undefined {
  const pathname = usePathname();
  return (href, exact = false) =>
    pathname === href ? "page" : !exact && href !== "/" && pathname.startsWith(`${href}/`) ? "true" : undefined;
}

/**
 * Text tabs that are links to sibling pages (page-level sections). The current one carries `aria-current`;
 * `exact` items are current only on their own path (a section's overview).
 */
export function NavTabs({
  items,
  label,
  className,
}: {
  items: readonly { href: string; title: string; exact?: boolean }[];
  label: string;
  className?: string;
}) {
  const current = useLinkCurrent();
  return (
    <nav aria-label={label} className={className}>
      <ul className={TAB_LIST}>
        {items.map((item) => {
          const state = current(item.href, item.exact);
          return (
            <li key={item.href} className="flex shrink-0">
              <Link href={item.href} aria-current={state} className={cn(TAB, state ? TAB_CURRENT : TAB_OTHER)}>
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type Option<T extends string> = { value: T; title: string; spoken?: string; disabled?: boolean };

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "segmented",
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "segmented" | "ranges";
}) {
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const { refs, onKeyDown } = useRovingKeys(
    options.length,
    selected,
    (index) => onChange(options[index].value),
    (index) => !options[index].disabled,
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex gap-1 p-1",
        variant === "segmented" ? "rounded-medium bg-track" : "overflow-x-auto [scrollbar-width:none]",
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
              "min-h-11 px-2 transition-colors duration-200 motion-reduce:transition-none aria-disabled:opacity-42",
              variant === "segmented"
                ? cn("flex-1 rounded-small text-secondary font-semibold desk:rounded-[0.5rem] desk:font-medium", isSelected ? "bg-raised text-primary-text shadow-raised" : "text-secondary-text hover:text-primary-text")
                : cn("min-w-11 shrink-0 rounded-full text-caption font-semibold", isSelected ? "bg-accent-soft text-accent" : "text-secondary-text hover:text-primary-text"),
            )}
          >
            {option.title}
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

/** Range chips `1D · 1S · 1M · 3M · 6M · 1A · Tudo`; disabled ranges stay visible but inert. */
export function TimeRangePicker({
  value,
  onChange,
  ranges = TIME_RANGES,
  isEnabled = () => true,
  label,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  ranges?: readonly TimeRange[];
  isEnabled?: (range: TimeRange) => boolean;
  label: string;
}) {
  const t = useTranslations();
  const options = [...new Set(ranges)].map((range) => ({
    value: range,
    title: range === "all" ? t("common.all") : t(`market.range.${range}`),
    spoken: t(`components.range.${range}Accessibility`),
    disabled: !isEnabled(range),
  }));
  return <OptionGroup options={options} value={value} onChange={onChange} label={label} variant="ranges" />;
}

/** The search field look: 44 px, 12 px corners, a hairline border, the magnifier first. Shared with the palette button. */
export const FIELD =
  "flex min-h-12 items-center gap-2 rounded-medium border border-field-border bg-card-background pl-4 pr-1 text-secondary-text desk:min-h-11 desk:pl-3";

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
    <div className={cn(FIELD, "focus-within:border-accent focus-within:outline-2 focus-within:outline-accent/30", className)}>
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
        className="min-w-0 flex-1 bg-transparent py-3 desk:py-2 text-body text-primary-text outline-none placeholder:text-secondary-text [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={t("clearAccessibility")}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <Icon name="close" scale="s" />
        </button>
      ) : hint ? (
        <KeyHint>{hint}</KeyHint>
      ) : null}
    </div>
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
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(THEME_EVENT));
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
export function ThemeMenu({ initial, icon = "settings" }: { initial: Theme; icon?: IconName }) {
  const t = useTranslations();
  const [theme, setTheme] = useTheme(initial);
  return (
    <Menu
      label={t("common.theme")}
      icon={icon}
      entries={THEMES.map((value) => ({
        kind: "check" as const,
        label: t(`designSystem.appearance.${value}`),
        checked: theme === value,
        onToggle: () => setTheme(value),
      }))}
    />
  );
}
