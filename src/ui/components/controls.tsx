"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useRef, useState } from "react";

import { cn } from "../cn";
import { Icon } from "../icons/icon";
import { THEME_COOKIE, type Theme, THEMES } from "../theme/theme";

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

/** Text tabs; the selected tab has weight and an accent underline. */
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
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-6 overflow-x-auto border-b border-separator [scrollbar-width:none]">
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
          className={cn(
            "relative min-h-12 shrink-0 text-body desk:min-h-11",
            index === selected
              ? "font-semibold text-primary-text after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-accent"
              : "text-secondary-text",
          )}
        >
          {title}
        </button>
      ))}
    </div>
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
        variant === "segmented" ? "rounded-medium bg-elevated-background" : "overflow-x-auto [scrollbar-width:none]",
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
              "min-h-11 rounded-small px-2 transition-colors duration-200 motion-reduce:transition-none aria-disabled:opacity-42",
              variant === "segmented" ? "flex-1 text-secondary font-semibold" : "min-w-11 shrink-0 text-caption font-semibold",
              isSelected ? "bg-accent-soft text-accent" : "text-secondary-text",
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

/** Rounded search field with a clear button. */
export function SearchField({
  value,
  onChange,
  placeholder,
  name,
  autoFocus,
  onKeyDown,
  controls,
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
}) {
  const t = useTranslations("designSystem.search");
  const input = useRef<HTMLInputElement>(null);
  const prompt = placeholder ?? t("prompt");
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-medium bg-elevated-background pl-4 pr-1 desk:min-h-11 desk:pl-3 text-secondary-text focus-within:outline-2 focus-within:outline-accent">
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
      ) : null}
    </div>
  );
}

/** Sistema / Claro / Escuro. Saved in a cookie so the server renders the right theme on the next load. */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const t = useTranslations();
  const [theme, setTheme] = useState(initial);
  return (
    <SegmentedControl
        label={t("common.theme")}
        value={theme}
        onChange={(next) => {
          setTheme(next);
          document.documentElement.dataset.theme = next;
          document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        }}
      options={THEMES.map((value) => ({ value, title: t(`designSystem.appearance.${value}`) }))}
    />
  );
}
