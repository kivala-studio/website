import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import { FORMAT_CASES } from "./cases";
import { latestSelectableInstant, luandaCivilDate } from "./date";
import { createFormat, type FormatLocale, type Translate } from "./index";
import { formatNumber } from "./number";

const translator = (locale: FormatLocale): Translate => {
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en });
  return (key, values) => t(key as never, values as never);
};

describe("formatters", () => {
  for (const locale of ["pt", "en"] as const) {
    const rows = FORMAT_CASES.filter((row) => row[locale] !== undefined);
    it.each(rows)(`${locale}: $name`, (row) => {
      const translate = translator(row.ptMessages ? "pt" : locale);
      expect(row.run(createFormat(locale, translate))).toBe(row[locale]);
    });
  }

  it("matches ICU grouping, rounding and signs for generated values", () => {
    const values = Array.from({ length: 400 }, (_, index) => {
      const magnitude = 10 ** ((index % 13) - 3);
      const raw = ((index * 7919) % 100003) / 997;
      return ((index % 2 ? -1 : 1) * raw * magnitude).toFixed(6);
    });
    for (const [locale, tag] of [["pt", "pt-AO"], ["en", "en-AO"]] as const) {
      for (const digits of [0, 2, 4]) {
        const icu = new Intl.NumberFormat(tag, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
          roundingMode: "halfEven",
        });
        for (const value of values) {
          expect(formatNumber(value, locale, { minFraction: digits, maxFraction: digits })).toBe(icu.format(value as never));
        }
      }
    }
  });
});

describe("Luanda civil days", () => {
  it("permits all of today but not tomorrow in a date-only picker", () => {
    for (const hour of [0, 9, 23]) {
      const now = Date.UTC(2026, 9, 8, hour - 1); // `hour` o'clock in Luanda on 8 October
      const latest = latestSelectableInstant(now);
      expect(luandaCivilDate(latest)).toBe("2026-10-08");
      expect(latest.getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 9, 8, 11));
      expect(luandaCivilDate(latest.getTime() + 1000)).toBe("2026-10-09");
    }
  });

  it("reads instants in Luanda, not in the runtime zone", () => {
    expect(luandaCivilDate(Date.parse("2026-09-23T23:30:00Z"))).toBe("2026-09-24");
    expect(luandaCivilDate(Date.parse("2026-09-23T22:59:59Z"))).toBe("2026-09-23");
  });
});
