import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Transcribed from iOS Invest.AO/Core/DesignSystem/SemanticColors.swift: [light, dark, increased-contrast light].
const SEMANTIC_COLORS: Record<string, [string, string, string?]> = {
  "app-background": ["F2F3F5", "090B0F"],
  "elevated-background": ["FFFFFF", "12151B"],
  "card-background": ["FFFFFF", "171B22"],
  "primary-text": ["182231", "F5F7FA"],
  "secondary-text": ["485364", "A6AFBD", "283445"],
  "tertiary-text": ["596579", "747E8E", "3B4759"],
  accent: ["1854C5", "5A9BFF"],
  "on-accent": ["FFFFFF", "090B0F"],
  positive: ["08704C", "35C98B"],
  negative: ["B9233D", "FF6677"],
  warning: ["845000", "F5B544"],
  separator: ["C5CDD8", "2A303A", "778396"],
  "chart-grid": ["CBD2DC", "252B34", "778396"],
  "card-outline": ["C9D0DB", "2A303A", "778396"],
  "control-outline": ["778396", "2A303A"],
  "selected-tab-background": ["E2EAFA", "303238"],
  "widget-background": ["F2F3F5", "090B0F"],
  "action-surface": ["E5E9EF", "171E2B"],
  "accent-soft": ["E2EAFA", "192D4B"],
  "comparison-orange": ["A34E00", "FF9400"],
  "comparison-purple": ["7935B5", "AD52E0"],
};

const css = readFileSync(path.join(import.meta.dirname, "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing block ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*#([0-9a-f]{6});/g)].map((m) => [m[1], m[2].toUpperCase()]));
}

describe("colour tokens", () => {
  const light = block(":root");
  const contrast = block("@media (prefers-contrast: more) {\n  :root");
  const dark = block(':root[data-theme="dark"]');
  const systemDark = block(':root:not([data-theme="light"])');

  it("defines the 21 iOS colours in light, dark and system dark", () => {
    expect(Object.keys(light)).toHaveLength(21);
    for (const [name, [lightHex, darkHex]] of Object.entries(SEMANTIC_COLORS)) {
      expect(light[name], name).toBe(lightHex);
      expect(dark[name], name).toBe(darkHex);
      expect(systemDark[name], name).toBe(darkHex);
    }
  });

  it("raises contrast only where iOS has an increased-contrast value", () => {
    const expected = Object.fromEntries(
      Object.entries(SEMANTIC_COLORS).filter(([, values]) => values[2]).map(([name, values]) => [name, values[2]]),
    );
    expect(contrast).toEqual(expected);
  });
});
