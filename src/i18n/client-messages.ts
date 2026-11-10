import type { Messages } from "next-intl";

/**
 * Namespaces that client components read. Only these are serialised into every page; the whole catalogue
 * (~120 kB) would otherwise ride along in each HTML response and delay the first paint on mobile.
 * Server components can use any namespace. Add a namespace here when a client component starts using it.
 */
export const CLIENT_NAMESPACES = ["common", "components", "designSystem", "errors", "formatting", "market", "site"] as const;

export function pickClientMessages(messages: Messages): Partial<Messages> {
  return Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]));
}
