import {
  ACKNOWLEDGE_LIMIT,
  type ActivityCursor,
  type ActivityFilter,
  type ActivityItem,
  filterOf,
  hasNewActivity,
  isVisible,
  mergeItems,
} from "@/domain/activity/activity";
import { type ErrorCoordinator, isCancellation } from "@/domain/errors";

export interface ActivityPageResult {
  readonly items: readonly ActivityItem[];
  readonly cursor: ActivityCursor | null;
}

export interface ActivityReceipt {
  readonly notificationIDs: string[];
  readonly deliveryIDs: string[];
  readonly opened: boolean;
}

export interface ActivityRepository {
  read(cursor: ActivityCursor | null, signal?: AbortSignal): Promise<ActivityPageResult>;
  markRead(receipt: ActivityReceipt): Promise<void>;
}

export type ActivityStatus = "idle" | "loading" | "loaded" | "failed";

export interface ActivitySnapshot {
  readonly status: ActivityStatus;
  /** Newest first: the first page, refreshed, plus every older page loaded since. */
  readonly items: readonly ActivityItem[];
  /** The next older page, or null when the last one is loaded. */
  readonly cursor: ActivityCursor | null;
  readonly loadingMore: boolean;
  /** When the shown history was last read from the server. */
  readonly loadedAt: number | null;
  /** The last refresh failed; the earlier history stays. */
  readonly stale: boolean;
  /** Some read receipts were not saved; they stay read here and can be sent again. */
  readonly receiptsPending: boolean;
  /** The bell's dot; before the first read, the server's answer for the page. */
  readonly hasNew: boolean;
}

/** The bell and the inbox are re-evaluated every minute while the tab is visible (iOS: 60 s). */
export const ACTIVITY_REFRESH_MS = 60_000;

/**
 * The Activity centre's state for one account (iOS `ActivityCenterStore`, server-backed). Opening the inbox marks
 * nothing read; a row becomes read when opened or marked, optimistically and for good (no "mark unread"). Refreshes
 * are explicit or on the minute while visible; a failed receipt is never retried on its own.
 */
export class ActivityStore {
  private state: ActivitySnapshot;
  private readonly listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private loadingMore: Promise<void> | null = null;
  private pages = 0;
  private readonly unsent = { notifications: new Set<string>(), deliveries: new Set<string>() };

  constructor(
    private readonly repository: ActivityRepository,
    private readonly errors: ErrorCoordinator,
    initialHasNew: boolean,
    private readonly events: { arrived?: (items: readonly ActivityItem[]) => void } = {},
    private readonly now: () => number = Date.now,
  ) {
    this.state = { status: "idle", items: [], cursor: null, loadingMore: false, loadedAt: null, stale: false, receiptsPending: false, hasNew: initialHasNew };
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<ActivitySnapshot>) {
    const next = { ...this.state, ...change };
    if (next.status === "loaded") next.hasNew = hasNewActivity(next.items, this.now());
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  /**
   * Reads the newest page. `quiet` (the minute refresh) shows no toast on failure; the page keeps its history and
   * says when it was saved. New unread rows that arrive after the first read are announced.
   */
  load({ quiet = false, signal }: { quiet?: boolean; signal?: AbortSignal } = {}): Promise<void> {
    if (this.loading) return this.loading;
    const task = this.read(quiet, signal).finally(() => {
      if (this.loading === task) this.loading = null;
    });
    this.loading = task;
    return task;
  }

  private async read(quiet: boolean, signal?: AbortSignal) {
    const first = this.state.status !== "loaded";
    if (first) this.set({ status: "loading" });
    try {
      const page = await this.repository.read(null, signal);
      if (signal?.aborted) return first ? this.set({ status: "idle" }) : undefined;
      const known = new Set(this.state.items.map((item) => item.id));
      const items = mergeItems(this.state.items, page.items);
      // Older pages already loaded keep their own continuation.
      const cursor = this.pages > 1 ? this.state.cursor : page.cursor;
      this.pages = Math.max(this.pages, 1);
      this.set({ status: "loaded", items, cursor, loadedAt: this.now(), stale: false });
      if (!first) {
        const now = this.now();
        const arrived = page.items.filter((item) => !known.has(item.id) && !item.read && isVisible(item, now));
        if (arrived.length > 0) this.events.arrived?.(arrived);
      }
    } catch (error) {
      if (signal?.aborted || isCancellation(error)) return first ? this.set({ status: "idle" }) : undefined;
      // A first read fails into the page's error state; a refresh the person asked for gets one retryable toast.
      if (first) this.errors.handle(error, "activity.load");
      else if (!quiet) this.errors.present(error, "activity.load", { retry: () => this.load() });
      this.set(first ? { status: "failed" } : { stale: true });
    }
  }

  /** The next older keyset page. */
  loadMore(): Promise<void> {
    if (this.loadingMore) return this.loadingMore;
    const cursor = this.state.cursor;
    if (this.state.status !== "loaded" || !cursor) return Promise.resolve();
    const task = (async () => {
      this.set({ loadingMore: true });
      try {
        const page = await this.repository.read(cursor);
        this.pages += 1;
        this.set({ items: mergeItems(this.state.items, page.items), cursor: page.cursor, loadingMore: false });
      } catch (error) {
        this.set({ loadingMore: false });
        if (!isCancellation(error)) this.errors.present(error, "activity.loadMore", { retry: () => this.loadMore() });
      }
    })().finally(() => {
      this.loadingMore = null;
    });
    this.loadingMore = task;
    return task;
  }

  /** Marks rows read here at once and tells the server; `opened` when the row itself was opened. */
  markRead(ids: readonly string[], opened = false): Promise<void> {
    const targets = this.state.items.filter((item) => ids.includes(item.id) && !item.read);
    if (targets.length === 0) return Promise.resolve();
    const marked = new Set(targets.map((item) => item.id));
    this.set({ items: this.state.items.map((item) => (marked.has(item.id) ? { ...item, read: true } : item)) });
    return this.send(
      targets.flatMap((item) => item.notificationIDs),
      targets.flatMap((item) => item.deliveryIDs),
      opened,
    );
  }

  /** "Ler todas": only the visible unread rows of the current filter. */
  markAllRead(filter: ActivityFilter): Promise<void> {
    const now = this.now();
    return this.markRead(this.state.items.filter((item) => !item.read && filterOf(item.category) === filter && isVisible(item, now)).map((item) => item.id));
  }

  /** Sends every receipt that failed before (the quiet "pending" line's action). */
  retryReceipts(): Promise<void> {
    const notifications = [...this.unsent.notifications];
    const deliveries = [...this.unsent.deliveries];
    this.unsent.notifications.clear();
    this.unsent.deliveries.clear();
    this.set({ receiptsPending: false });
    return this.send(notifications, deliveries, false);
  }

  private async send(notifications: readonly string[], deliveries: readonly string[], opened: boolean) {
    const batches: ActivityReceipt[] = [];
    for (let start = 0; start < Math.max(notifications.length, 1); start += ACKNOWLEDGE_LIMIT) {
      batches.push({ notificationIDs: notifications.slice(start, start + ACKNOWLEDGE_LIMIT), deliveryIDs: start === 0 ? [...deliveries] : [], opened });
    }
    for (const batch of batches) {
      if (batch.notificationIDs.length === 0 && batch.deliveryIDs.length === 0) continue;
      try {
        await this.repository.markRead(batch);
      } catch (error) {
        if (isCancellation(error)) return;
        for (const id of batch.notificationIDs) this.unsent.notifications.add(id);
        for (const id of batch.deliveryIDs) this.unsent.deliveries.add(id);
        this.set({ receiptsPending: true });
      }
    }
  }
}
