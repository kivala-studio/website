import { type SubscriptionAccess, decodeSubscriptionAccess } from "./access";
import { type MovementSensitivity, isMovementSensitivity } from "./alerts";
import { deduplicated } from "./watchlist-ordering";

/** A `watchlist_items` row as the list needs it (contract §4.1). */
export interface WatchlistItem {
  readonly id: string;
  readonly automaticAlerts: boolean;
}

/** A Plus group (contract §4.2): members are watched ids, newest groups last. */
export interface WatchlistGroup {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly members: readonly string[];
}

/** The deleted row, so an undo re-inserts exactly it (iOS `WatchlistRemovalReceipt`). */
export interface WatchlistReceipt {
  readonly userID: string;
  readonly securityID: string;
  readonly sortOrder: number;
  readonly automaticAlertsEnabled: boolean;
  readonly createdAt: string;
}

/** Everything `/lista` reads in one request. */
export interface WatchlistDocument {
  readonly items: readonly WatchlistItem[];
  readonly groups: readonly WatchlistGroup[];
  readonly access: SubscriptionAccess | null;
  readonly sensitivity: MovementSensitivity;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export function decodeReceipt(value: unknown): WatchlistReceipt | null {
  if (!isRecord(value)) return null;
  const { userID, securityID, sortOrder, automaticAlertsEnabled, createdAt } = value;
  if (typeof userID !== "string" || typeof securityID !== "string" || typeof createdAt !== "string") return null;
  if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || typeof automaticAlertsEnabled !== "boolean") return null;
  return { userID, securityID, sortOrder, automaticAlertsEnabled, createdAt };
}

/** The route's JSON (`/api/account/watchlist`); null when it is not one. */
export function decodeWatchlistDocument(body: unknown): WatchlistDocument | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  const items: WatchlistItem[] = [];
  const seen = new Set<string>();
  for (const item of body.items) {
    if (!isRecord(item) || typeof item.id !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push({ id: item.id, automaticAlerts: item.automaticAlerts === true });
  }
  const groups = (Array.isArray(body.groups) ? body.groups : []).flatMap((group): WatchlistGroup[] => {
    if (!isRecord(group) || typeof group.id !== "string" || typeof group.name !== "string") return [];
    return [{ id: group.id, name: group.name, createdAt: typeof group.createdAt === "number" ? group.createdAt : 0, members: deduplicated(strings(group.members)) }];
  });
  return {
    items,
    groups,
    access: isRecord(body.access) ? decodeAccessJSON(body.access) : null,
    sensitivity: isMovementSensitivity(body.sensitivity) ? body.sensitivity : "normal",
  };
}

/** The access document as account routes send it (already decoded on the server, camel case). */
export function decodeAccessJSON(value: unknown): SubscriptionAccess | null {
  if (!isRecord(value) || typeof value.isPlus !== "boolean" || typeof value.enforcementEnabled !== "boolean") return null;
  return decodeSubscriptionAccess({
    is_plus: value.isPlus,
    is_pro: value.isPro,
    enforcement_enabled: value.enforcementEnabled,
    week_start: value.weekStart,
    resets_at: value.resetsAt,
    comparison_pair: value.comparisonPair,
    active_watchlist_ids: value.activeWatchlistIDs,
    movement_security_id: value.movementSecurityID,
  });
}

/** Free under enforcement: which saved ids are paused (outside the server's active three). */
export function pausedIDs(order: readonly string[], access: SubscriptionAccess | null): ReadonlySet<string> {
  if (!access || access.isPlus || !access.enforcementEnabled) return new Set();
  const active = new Set(access.activeWatchlistIDs);
  return new Set(order.filter((id) => !active.has(id)));
}
