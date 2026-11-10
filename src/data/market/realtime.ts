import type { SupabaseClient } from "@supabase/supabase-js";

import { parseInstant } from "@/domain/market/zone";

/** `market:prices` is private (live-facts: confirmed); clients receive, never send. */
export const MARKET_BROADCAST_PRIVATE = true;
export const MARKET_BROADCAST_TOPIC = "market:prices";
export const MARKET_BROADCAST_EVENT = "quotes";
/** Wait before joining again after the channel fails or closes (iOS). */
export const MARKET_BROADCAST_RETRY_MS = 30_000;

export type QuoteAnnouncement = { generatedAt?: number; etag?: string };

/**
 * Only the announcement metadata is read; prices in the payload are never used, the snapshot
 * stays the source of truth.
 */
export function readAnnouncement(payload: unknown): QuoteAnnouncement {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const generated = typeof record.generated_at === "string" ? parseInstant(record.generated_at) : undefined;
  const etag = typeof record.etag === "string" && record.etag !== "" ? record.etag : undefined;
  return { generatedAt: generated, etag };
}

/**
 * Joins the broadcast while `signal` is live (the provider aborts it when the tab is hidden) and
 * rejoins 30 s after a failure. Polling stays the watchdog whatever happens here.
 */
export function listenToQuoteAnnouncements(
  client: SupabaseClient,
  handlers: { onStatus: (connected: boolean) => void; onAnnouncement: (announcement: QuoteAnnouncement) => void },
  signal: AbortSignal,
): void {
  let retry: ReturnType<typeof setTimeout> | undefined;
  const join = () => {
    if (signal.aborted) return;
    const channel = client
      .channel(MARKET_BROADCAST_TOPIC, { config: { private: MARKET_BROADCAST_PRIVATE } })
      .on("broadcast", { event: MARKET_BROADCAST_EVENT }, (message) => handlers.onAnnouncement(readAnnouncement(message.payload)));
    const leave = () => {
      handlers.onStatus(false);
      void client.removeChannel(channel);
    };
    signal.addEventListener("abort", leave, { once: true });
    channel.subscribe((status) => {
      if (signal.aborted) return;
      if (status === "SUBSCRIBED") return handlers.onStatus(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        signal.removeEventListener("abort", leave);
        leave();
        clearTimeout(retry);
        retry = setTimeout(join, MARKET_BROADCAST_RETRY_MS);
      }
    });
  };
  signal.addEventListener("abort", () => clearTimeout(retry), { once: true });
  join();
}
