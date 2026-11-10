import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { createFormat, type Format, type FormatLocale } from "@/domain/format";

/** Locale-bound formatters for server and client components. */
export function useFormat(): Format {
  const locale = useLocale() as FormatLocale;
  const t = useTranslations();
  return useMemo(() => createFormat(locale, (key, values) => t(key as never, values as never)), [locale, t]);
}
