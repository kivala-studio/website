import { describe, expect, it } from "vitest";

import type { ActivityCursor, ActivityItem } from "@/domain/activity/activity";
import { ErrorCoordinator } from "@/domain/errors";

import { type ActivityReceipt, type ActivityRepository, ActivityStore } from "./activity-store";

const NOW = Date.parse("2026-09-25T12:00:00Z");
const transport = () => Object.assign(new Error("Failed to fetch"), { name: "TypeError" });

const item = (n: number, overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: `account:${n}`,
  occurredAt: NOW - n * 3_600_000,
  category: "movements",
  destination: { kind: "none" },
  priority: 0,
  read: false,
  privacy: "public_market",
  newsWindow: false,
  copy: { kind: "composition", title: `Row ${n}`, body: "", accessibilityText: null },
  notificationIDs: [`n-${n}`],
  deliveryIDs: [],
  ...overrides,
});

/** The server's inbox: keyset pages of two rows, newest first, with failures on demand. */
class MemoryInbox implements ActivityRepository {
  readonly receipts: ActivityReceipt[] = [];
  readonly cursors: (ActivityCursor | null)[] = [];
  failReads = false;
  failReceipts = false;
  constructor(public rows: ActivityItem[]) {}

  async read(cursor: ActivityCursor | null) {
    this.cursors.push(cursor);
    if (this.failReads) throw transport();
    const start = cursor ? this.rows.findIndex((row) => row.id === cursor.id) + 1 : 0;
    const items = this.rows.slice(start, start + 2);
    const last = items.at(-1);
    return { items, cursor: items.length < 2 || !last ? null : { createdAt: new Date(last.occurredAt).toISOString(), id: last.id } };
  }

  async markRead(receipt: ActivityReceipt) {
    if (this.failReceipts) throw transport();
    this.receipts.push(receipt);
  }
}

const store = (inbox: MemoryInbox, arrived: ActivityItem[][] = [], errors = new ErrorCoordinator()) =>
  new ActivityStore(inbox, errors, false, { arrived: (items) => arrived.push([...items]) }, () => NOW);

describe("ActivityStore", () => {
  it("pages by keyset, keeps older pages on refresh and announces only rows that arrive later", async () => {
    const inbox = new MemoryInbox([item(1), item(2), item(3), item(4, { read: true }), item(5)]);
    const arrived: ActivityItem[][] = [];
    const activity = store(inbox, arrived);
    await activity.load();
    expect(activity.getSnapshot()).toMatchObject({ status: "loaded", hasNew: true });
    await activity.loadMore();
    expect(activity.getSnapshot().items.map((row) => row.id)).toEqual(["account:1", "account:2", "account:3", "account:4"]);
    expect(inbox.cursors.at(-1)).toMatchObject({ id: "account:2" });

    inbox.rows = [item(0), ...inbox.rows];
    await activity.load({ quiet: true });
    expect(activity.getSnapshot().items.map((row) => row.id)).toEqual(["account:0", "account:1", "account:2", "account:3", "account:4"]);
    // The continuation still points past the older page already shown.
    expect(activity.getSnapshot().cursor).toMatchObject({ id: "account:4" });
    expect(arrived.map((rows) => rows.map((row) => row.id))).toEqual([["account:0"]]);
  });

  it("opening a row marks it read at once and tells the server, deliveries included", async () => {
    const inbox = new MemoryInbox([item(1, { notificationIDs: [], deliveryIDs: ["d1", "d2"] }), item(2)]);
    const activity = store(inbox);
    await activity.load();
    await activity.markRead(["account:1"], true);
    expect(activity.getSnapshot().items[0].read).toBe(true);
    expect(inbox.receipts).toEqual([{ notificationIDs: [], deliveryIDs: ["d1", "d2"], opened: true }]);
    // A refresh that still has the old state does not make it unread again.
    await activity.load({ quiet: true });
    expect(activity.getSnapshot().items[0].read).toBe(true);
  });

  it("a failed receipt keeps the row read and waits for an explicit retry", async () => {
    const inbox = new MemoryInbox([item(1), item(2)]);
    const activity = store(inbox);
    await activity.load();
    inbox.failReceipts = true;
    await activity.markRead(["account:2"]);
    expect(activity.getSnapshot()).toMatchObject({ receiptsPending: true });
    expect(activity.getSnapshot().items[1].read).toBe(true);
    expect(inbox.receipts).toEqual([]);
    inbox.failReceipts = false;
    await activity.retryReceipts();
    expect(inbox.receipts).toEqual([{ notificationIDs: ["n-2"], deliveryIDs: [], opened: false }]);
    expect(activity.getSnapshot().receiptsPending).toBe(false);
  });

  it("'Ler todas' marks only the current filter's unread rows, in batches the server accepts", async () => {
    const rows = Array.from({ length: 150 }, (_, n) => item(n + 1, { occurredAt: NOW - n * 1000 }));
    const inbox = new MemoryInbox([...rows, item(999, { category: "news", newsWindow: true, occurredAt: NOW - 1000 })]);
    inbox.read = async () => ({ items: inbox.rows, cursor: null });
    const activity = store(inbox);
    await activity.load();
    await activity.markAllRead("movements");
    expect(inbox.receipts.map((receipt) => receipt.notificationIDs.length)).toEqual([100, 50]);
    expect(activity.getSnapshot().items.find((row) => row.id === "account:999")?.read).toBe(false);
    expect(activity.getSnapshot().hasNew).toBe(true);
    await activity.markAllRead("news");
    expect(activity.getSnapshot().hasNew).toBe(false);
  });

  it("a quiet refresh that fails keeps the history and says so, without a toast", async () => {
    const errors = new ErrorCoordinator();
    const inbox = new MemoryInbox([item(1)]);
    const activity = store(inbox, [], errors);
    await activity.load();
    inbox.failReads = true;
    await activity.load({ quiet: true });
    expect(activity.getSnapshot()).toMatchObject({ status: "loaded", stale: true, items: [expect.objectContaining({ id: "account:1" })] });
    expect(errors.current).toBeNull();
    await activity.load();
    expect(errors.current).not.toBeNull();
  });
});
