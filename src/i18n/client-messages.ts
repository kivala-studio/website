import type { Messages } from "next-intl";

import { ERROR_MESSAGE_KEYS } from "@/domain/errors";

/**
 * Namespaces that client components read. Only these are serialised into every page; the whole catalogue
 * (~120 kB) would otherwise ride along in each HTML response and delay the first paint on mobile.
 * Server components can use any namespace. Add a namespace here when a client component starts using it.
 */
export const CLIENT_NAMESPACES = ["common", "components", "designSystem", "errors", "formatting", "market", "site"] as const;

/** Single keys from larger namespaces: the shared formatter's bands and days, and every error the presenter can show. */
export const FORMAT_MESSAGE_KEYS = [
  "legacy.entre0E",
  "legacy.entreE0",
  "notifications.date.today",
  "notifications.date.yesterday",
] as const;

export const CLIENT_KEYS: readonly string[] = [...FORMAT_MESSAGE_KEYS, ...ERROR_MESSAGE_KEYS];

type Tree = { [key: string]: string | Tree };

function setPath(target: Tree, path: string[], value: string | Tree) {
  let node = target;
  for (const segment of path.slice(0, -1)) {
    const next = node[segment];
    node = typeof next === "object" ? next : (node[segment] = {});
  }
  node[path[path.length - 1]] = value;
}

export function pickClientMessages(messages: Messages): Partial<Messages> {
  const source = messages as unknown as Tree;
  const picked: Tree = {};
  for (const namespace of CLIENT_NAMESPACES) if (source[namespace]) picked[namespace] = source[namespace];
  for (const key of CLIENT_KEYS) {
    const path = key.split(".");
    if (CLIENT_NAMESPACES.includes(path[0] as (typeof CLIENT_NAMESPACES)[number])) continue;
    let value: string | Tree | undefined = source;
    for (const segment of path) value = typeof value === "object" ? value[segment] : undefined;
    if (value !== undefined) setPath(picked, path, value);
  }
  return picked as Partial<Messages>;
}
