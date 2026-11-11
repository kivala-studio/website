import type { CivilDate } from "../format/date";
import type { EpochMs } from "./zone";

/** A new-admission event from `market_events` (contract §3.9), as pages need it. */
export interface ListingEvent {
  readonly id: string;
  readonly issuerID?: string;
  readonly securityID?: string;
  readonly title: string;
  readonly scheduledDate?: CivilDate;
  readonly startsAt: EpochMs;
  readonly expiresAt: EpochMs;
  readonly status: "scheduled" | "confirmed";
  readonly highlightsHome: boolean;
  readonly priority: number;
  readonly sources: readonly { readonly name: string; readonly url: string }[];
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);
const instant = (value: unknown) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const https = (value: unknown) => {
  const url = text(value);
  if (!url) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
};

/** One row, or undefined when it is not a usable new-listing event (cancelled, unknown kind, broken dates). */
export function decodeListingEvent(row: unknown): ListingEvent | undefined {
  if (typeof row !== "object" || row === null) return undefined;
  const value = row as Record<string, unknown>;
  const id = text(value.id);
  const title = text(value.title);
  const startsAt = instant(value.starts_at);
  const expiresAt = instant(value.expires_at);
  if (!id || !title || startsAt === undefined || expiresAt === undefined || expiresAt <= startsAt) return undefined;
  if (value.kind !== "new_listing" || (value.status !== "scheduled" && value.status !== "confirmed")) return undefined;
  const scheduled = text(value.scheduled_date);
  const sources = [
    { name: text(value.source_name), url: https(value.source_url) },
    { name: text(value.source_name), url: https(value.confirmation_url) },
  ].flatMap(({ name, url }) => (url ? [{ name: name ?? new URL(url).hostname.replace(/^www\./, ""), url }] : []));
  return {
    id,
    title,
    issuerID: text(value.issuer_id),
    securityID: text(value.security_id),
    scheduledDate: scheduled && CIVIL.test(scheduled) ? scheduled : undefined,
    startsAt,
    expiresAt,
    status: value.status,
    highlightsHome: value.highlights_home === true,
    priority: typeof value.priority === "number" ? value.priority : 0,
    sources: sources.filter((source, index) => sources.findIndex((other) => other.url === source.url) === index),
  };
}

/** Shown only between `starts_at` and `expires_at`. */
export const isListingActive = (event: ListingEvent, now: EpochMs) => event.startsAt <= now && now < event.expiresAt;

/** The Home highlight: the active, home-flagged event with the highest priority (then the soonest date). */
export function homeListing(events: readonly ListingEvent[], now: EpochMs): ListingEvent | undefined {
  return events
    .filter((event) => event.highlightsHome && isListingActive(event, now))
    .sort((a, b) => b.priority - a.priority || (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || a.id.localeCompare(b.id))[0];
}
