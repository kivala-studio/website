"use client";

import { type AbstractIntlMessages, NextIntlClientProvider, useLocale, useMessages, useTimeZone } from "next-intl";
import { type ReactNode, useMemo } from "react";

type Tree = { [key: string]: string | Tree };

function merge(base: Tree, extra: Tree): Tree {
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = result[key];
    result[key] = typeof value === "object" && typeof current === "object" ? merge(current, value) : value;
  }
  return result;
}

/** Adds an area's messages (picked on the server with `AREA_KEYS`) to the ones every page already ships. */
export function ScopedMessages({ messages, children }: { messages: AbstractIntlMessages; children: ReactNode }) {
  const locale = useLocale();
  const timeZone = useTimeZone();
  const base = useMessages();
  const merged = useMemo(() => merge(base as Tree, messages as Tree), [base, messages]);
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
