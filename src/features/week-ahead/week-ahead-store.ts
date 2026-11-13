import { isCancellation } from "@/domain/errors";
import { type EventBatch, type MarketEvent, type WeekSecurity, isReplayableBatch } from "@/domain/week-ahead/week-ahead";

export type WeekAheadData = {
  readonly batch: EventBatch;
  readonly securities: readonly WeekSecurity[];
  readonly heldIDs: ReadonlySet<string>;
  readonly closedDays: ReadonlySet<string>;
};

export type WeekAheadState = {
  readonly status: "loading" | "ready" | "unavailable";
  readonly data: WeekAheadData | null;
  /** The batch seen before the current one, for the date-correction badge. */
  readonly previous: readonly MarketEvent[];
  /** When the last read settled, on the server's clock (the batch's own times come from the server). */
  readonly checkedAt: number | null;
};

/** One read of the source: the data, `null` when the calendar cannot vouch for the week. Throws on failure. */
export type WeekAheadSource = (signal?: AbortSignal) => Promise<WeekAheadData | null>;

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

/** `/api/account/week-ahead`'s body as data, `null` for an unverified week; anything else is a decoding failure. */
export function decodeWeekAhead(body: Record<string, unknown>): WeekAheadData | null {
  if (body.verified === false) return null;
  const { fetchedAt, events, securities, heldIDs, closedDays } = body;
  if (body.verified !== true || typeof fetchedAt !== "number" || !isArray(events) || !isArray(securities) || !isArray(heldIDs) || !isArray(closedDays)) {
    throw new Error("week-ahead");
  }
  return {
    batch: { events: events as MarketEvent[], fetchedAt },
    securities: securities as WeekSecurity[],
    heldIDs: new Set(heldIDs as string[]),
    closedDays: new Set(closedDays as string[]),
  };
}

/**
 * The week ahead for one tab (iOS `WeekAheadCoordinator`): every read replaces the batch whole; after a failure the
 * batch read earlier replays for a day, marked as saved; an unverified week withholds everything.
 */
export class WeekAheadStore {
  private state: WeekAheadState = { status: "loading", data: null, previous: [], checkedAt: null };
  private readonly listeners = new Set<() => void>();
  private request = 0;
  /** Server clock minus this browser's, from the last batch. */
  private skew = 0;

  constructor(
    private readonly source: WeekAheadSource,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(state: WeekAheadState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private serverNow() {
    return this.now() + this.skew;
  }

  /** `retry` shows the checking state again while an unavailable week is read. */
  async load({ retry = false }: { retry?: boolean } = {}): Promise<void> {
    const token = ++this.request;
    if (retry && !this.state.data) this.set({ ...this.state, status: "loading" });
    try {
      const data = await this.source();
      if (token !== this.request) return;
      const current = this.state.data;
      if (data) this.skew = data.batch.fetchedAt - this.now();
      this.set(
        data
          ? { status: "ready", data, previous: current && current.batch.fetchedAt !== data.batch.fetchedAt ? current.batch.events : this.state.previous, checkedAt: this.serverNow() }
          : { status: "unavailable", data: null, previous: [], checkedAt: this.serverNow() },
      );
    } catch (error) {
      if (token !== this.request || isCancellation(error)) return;
      const current = this.state.data;
      this.set(
        current && isReplayableBatch(current.batch, this.serverNow())
          ? { ...this.state, status: "ready", data: { ...current, batch: { ...current.batch, isCached: true } }, checkedAt: this.serverNow() }
          : { status: "unavailable", data: null, previous: [], checkedAt: this.serverNow() },
      );
    }
  }
}
