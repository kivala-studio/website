"use client";

import { createTranslator } from "next-intl";
import { useEffect, useState } from "react";

import { FORMAT_CASES } from "@/domain/format/cases";
import { createFormat, type FormatLocale, type Translate } from "@/domain/format";
import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";

const translator = (locale: FormatLocale): Translate => {
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en });
  return (key, values) => t(key as never, values as never);
};

type Row = { id: string; expected: string; actual: string };

/** Runs the formatter table in the browser engine, so the same rows can be compared across engines. */
export function FormatCheck() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    const out: Row[] = [];
    for (const locale of ["pt", "en"] as const) {
      for (const row of FORMAT_CASES) {
        const expected = row[locale];
        if (expected === undefined) continue;
        const format = createFormat(locale, translator(row.ptMessages ? "pt" : locale));
        out.push({ id: `${locale}: ${row.name}`, expected, actual: row.run(format) });
      }
    }
    // Computed after mount so the browser's engine, not the server, produces each value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(out);
  }, []);
  if (!rows) return null;
  const failures = rows.filter((row) => row.actual !== row.expected);
  return (
    <div data-testid="format-check" data-total={rows.length} data-failures={failures.length}>
      <table className="w-full text-left text-caption">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-separator">
              <th scope="row" className="py-1 pr-3 font-normal text-secondary-text">{row.id}</th>
              <td className={row.actual === row.expected ? "py-1 text-primary-text" : "py-1 text-negative"}>{row.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
