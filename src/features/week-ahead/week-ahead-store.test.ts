import { describe, expect, it } from "vitest";

import type { MarketEvent } from "@/domain/week-ahead/week-ahead";

import { type WeekAheadData, WeekAheadStore } from "./week-ahead-store";

// iOS `testAuthoritativeRefreshReplacesRemovedEventsAndStoreDoesNotReturnExpiredCache`, for the tab's store.

const event = { id: "A" } as MarketEvent;
const data = (fetchedAt: number, events: MarketEvent[] = [event]): WeekAheadData => ({
  batch: { events, fetchedAt },
  securities: [],
  heldIDs: new Set(),
  closedDays: new Set(),
});

function store(answers: (WeekAheadData | null | Error)[], clock: { now: number }) {
  let call = 0;
  return new WeekAheadStore(async () => {
    const answer = answers[Math.min(call++, answers.length - 1)];
    if (answer instanceof Error) throw answer;
    return answer;
  }, () => clock.now);
}

describe("week ahead store", () => {
  it("replaces the batch whole and keeps the one before for corrections", async () => {
    const clock = { now: 1_000 };
    const subject = store([data(1_000), data(2_000, [])], clock);
    await subject.load();
    expect(subject.getSnapshot().data?.batch.events).toHaveLength(1);
    await subject.load();
    expect(subject.getSnapshot()).toMatchObject({ status: "ready", previous: [event] });
    expect(subject.getSnapshot().data?.batch.events).toHaveLength(0);
  });

  it("replays a kept batch as saved for a day after a failure, then gives up", async () => {
    const clock = { now: 1_000 };
    const subject = store([data(1_000), new Error("offline")], clock);
    await subject.load();
    clock.now += 10 * 60_000;
    await subject.load();
    expect(subject.getSnapshot().data?.batch.isCached).toBe(true);
    clock.now += 24 * 3_600_000;
    await subject.load();
    expect(subject.getSnapshot()).toMatchObject({ status: "unavailable", data: null });
  });

  it("withholds everything, kept batch included, when the calendar cannot vouch for the week", async () => {
    const subject = store([data(1_000), null], { now: 1_000 });
    await subject.load();
    await subject.load();
    expect(subject.getSnapshot()).toMatchObject({ status: "unavailable", data: null });
  });

  it("reads time on the server's clock", async () => {
    const subject = store([data(5_000_000)], { now: 1_000 });
    await subject.load();
    expect(subject.getSnapshot().checkedAt).toBe(5_000_000);
  });
});
