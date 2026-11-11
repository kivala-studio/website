import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { AREA_KEYS, CLIENT_NAMESPACES, pickMessages } from "./client-messages";
import { ScopedMessages } from "./scoped-messages";

/** Ships one area's extra client messages (see `AREA_KEYS`) with its pages. */
export async function AreaMessages({ area, children }: { area: keyof typeof AREA_KEYS; children: ReactNode }) {
  const messages = pickMessages(await getMessages(), AREA_KEYS[area], CLIENT_NAMESPACES) as AbstractIntlMessages;
  return <ScopedMessages messages={messages}>{children}</ScopedMessages>;
}
