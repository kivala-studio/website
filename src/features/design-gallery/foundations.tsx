"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/ui/cn";
import { Icon } from "@/ui/icons/icon";
import { ICON_PACK, type IconName } from "@/ui/icons/icon-pack";

import { GallerySection, Specimen } from "./specimen";

const SEMANTIC = [
  ["app-background", "bg-app-background"],
  ["elevated-background", "bg-elevated-background"],
  ["card-background", "bg-card-background"],
  ["primary-text", "bg-primary-text"],
  ["secondary-text", "bg-secondary-text"],
  ["tertiary-text", "bg-tertiary-text"],
  ["accent", "bg-accent"],
  ["on-accent", "bg-on-accent"],
  ["positive", "bg-positive"],
  ["negative", "bg-negative"],
  ["warning", "bg-warning"],
  ["separator", "bg-separator"],
  ["chart-grid", "bg-chart-grid"],
  ["card-outline", "bg-card-outline"],
  ["control-outline", "bg-control-outline"],
  ["selected-tab-background", "bg-selected-tab-background"],
  ["widget-background", "bg-widget-background"],
  ["action-surface", "bg-action-surface"],
  ["accent-soft", "bg-accent-soft"],
  ["comparison-orange", "bg-comparison-orange"],
  ["comparison-purple", "bg-comparison-purple"],
  ["brand-violet", "bg-brand-violet"],
] as const;

const WEB = [
  ["hairline", "bg-hairline"],
  ["card-border", "bg-card-border"],
  ["field-border", "bg-field-border"],
  ["track", "bg-track"],
  ["raised", "bg-raised"],
] as const;

const TYPE = [
  { role: "text-headline", face: "font-display", sizes: "44 · desk 36", sample: "1 250 000,00 Kz" },
  { role: "text-display", face: "font-display", sizes: "34 · desk 32", sample: "Mercado" },
  { role: "text-price", face: "font-display", sizes: "22 · desk 18", sample: "72 500,00 Kz" },
  { role: "text-section", face: "font-display", sizes: "20 · desk 22", sample: "Em movimento" },
  { role: "text-body", face: "font-sans", sizes: "17 · desk 16", sample: "Banco Angolano de Investimentos" },
  { role: "text-body", face: "font-display", sizes: "17 · desk 16", sample: "65 000,00 Kz · +2,14 %" },
  { role: "text-secondary", face: "font-sans", sizes: "15 · desk 14", sample: "Último fecho verificado · 17/11/2026" },
  { role: "text-caption", face: "font-sans", sizes: "12", sample: "Calculado pelo invest.ao" },
  { role: "text-micro", face: "font-sans uppercase", sizes: "11", sample: "Exemplo ilustrativo" },
] as const;

const RADII = [
  ["rounded-small", "12 · desk 8"],
  ["rounded-medium", "18 · desk 12"],
  ["rounded-large", "24 · desk 22"],
  ["rounded-card", "22"],
  ["rounded-full", "pill"],
] as const;

const SHADOWS = [
  ["panel", "panel utility"],
  ["shadow-panel bg-card-background", "shadow-panel"],
  ["shadow-raised bg-raised", "shadow-raised + bg-raised"],
  ["shadow-bar bg-elevated-background", "shadow-bar"],
  ["shadow-focus border border-accent bg-card-background", "shadow-focus + border-accent"],
] as const;

const SPACING = [
  ["w-1", "1 · 4"],
  ["w-2", "2 · 8"],
  ["w-3", "3 · 12"],
  ["w-4", "4 · 16"],
  ["w-5", "5 · 20"],
  ["w-6", "6 · 24"],
  ["w-8", "8 · 32"],
  ["w-10", "10 · 40"],
  ["w-12", "12 · 48"],
  ["w-16", "16 · 64"],
] as const;

/** Re-reads the tokens whenever the theme, the OS scheme or the contrast preference changes. */
function useThemeKey(): string {
  return useSyncExternalStore(
    (listener) => {
      const observer = new MutationObserver(listener);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      const queries = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map((query) => window.matchMedia(query));
      queries.forEach((query) => query.addEventListener("change", listener));
      return () => {
        observer.disconnect();
        queries.forEach((query) => query.removeEventListener("change", listener));
      };
    },
    () =>
      [
        document.documentElement.dataset.theme,
        window.matchMedia("(prefers-color-scheme: dark)").matches,
        window.matchMedia("(prefers-contrast: more)").matches,
      ].join(),
    () => "",
  );
}

/** A token's value in the current theme, read from the page (so it always matches tokens.css). */
function tokenValue(themeKey: string, token: string) {
  return themeKey ? getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() : "";
}

function Swatches({ tokens, themeKey }: { tokens: readonly (readonly [string, string])[]; themeKey: string }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {tokens.map(([token, swatch]) => (
        <li key={token} className="flex min-w-0 items-center gap-3">
          <span aria-hidden className={cn("size-10 shrink-0 rounded-small border border-hairline", swatch)} />
          <span className="flex min-w-0 flex-col">
            <code className="truncate text-secondary text-primary-text">{token}</code>
            <code className="truncate text-caption text-secondary-text">{tokenValue(themeKey, token) || " "}</code>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Foundations() {
  const themeKey = useThemeKey();
  return (
    <GallerySection id="foundations" title="Foundations">
      <Specimen name="Colour · iOS semantic tokens">
        <Swatches tokens={SEMANTIC} themeKey={themeKey} />
      </Specimen>
      <Specimen name="Colour · web-only tokens">
        <Swatches tokens={WEB} themeKey={themeKey} />
      </Specimen>

      <Specimen name="Type scale">
        <ul className="flex flex-col divide-y divide-hairline">
          {TYPE.map((item) => (
            <li key={`${item.role}-${item.face}`} className="flex flex-col gap-1 py-3 md:flex-row md:items-baseline md:gap-6">
              <code className="shrink-0 text-caption text-secondary-text md:w-64">{`${item.role} ${item.face} · ${item.sizes}`}</code>
              <span className={cn(item.role, item.face, "min-w-0 text-primary-text")}>{item.sample}</span>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <Specimen name="Radii">
          <ul className="flex flex-wrap gap-4">
            {RADII.map(([radius, size]) => (
              <li key={radius} className="flex flex-col items-center gap-2">
                <span aria-hidden className={cn("size-16 border border-card-border bg-card-background", radius)} />
                <code className="text-caption text-secondary-text">{radius}</code>
                <span className="text-caption text-secondary-text">{size}</span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen name="Elevation">
          <ul className="flex flex-wrap gap-4">
            {SHADOWS.map(([classes, name]) => (
              <li key={name} className="flex w-28 flex-col items-center gap-2 text-center">
                <span aria-hidden className={cn("size-16 rounded-medium", classes)} />
                <code className="text-caption text-secondary-text">{name}</code>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>

      <Specimen name="Spacing · Tailwind step · px">
        <ul className="flex flex-col gap-2">
          {SPACING.map(([width, label]) => (
            <li key={width} className="flex items-center gap-3">
              <code className="w-20 shrink-0 text-caption text-secondary-text">{label}</code>
              <span aria-hidden className={cn("h-3 rounded-full bg-accent", width)} />
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen name="Icon · ICON_PACK">
        <ul className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {(Object.keys(ICON_PACK) as IconName[]).map((name) => (
            <li key={name} className="flex flex-col items-center gap-1 text-center">
              <Icon name={name} scale="l" className="text-primary-text" />
              <span className="text-micro break-all text-secondary-text">{name}</span>
            </li>
          ))}
        </ul>
      </Specimen>
    </GallerySection>
  );
}
