import test from "node:test";
import assert from "node:assert/strict";
import {
  readExposure,
  updateExposure,
  deleteExposure,
} from "../lib/content-exposure.ts";
import {
  recordExposure,
  recordUsefulness,
} from "../lib/insight-personalisation.ts";
const saved = new Map(),
  queues = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) || null,
  setItem: (key, value) => saved.set(key, value),
};
Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: {
    request: async (key, callback) => {
      const previous = queues.get(key) || Promise.resolve();
      const next = previous.catch(() => {}).then(callback);
      queues.set(key, next);
      return next;
    },
  },
});
const now = Date.now();
const candidate = (id) => ({
  id,
  factKeys: [id],
  topics: [],
  assets: [],
  family: "watchlistMovement",
  category: "watchlist",
  significance: 1,
  observedAt: now,
  expiresAt: now + 1000,
});
test("concurrent local receipts retain both writes, and account removal blocks later recreation", async () => {
  await Promise.all([
    updateExposure(
      "owner",
      async () => true,
      (old) => recordExposure(old, candidate("first"), true, now),
    ),
    updateExposure(
      "owner",
      async () => true,
      (old) =>
        recordUsefulness(old, candidate("second"), "watchlist", "fact", now),
    ),
  ]);
  assert.ok(readExposure("owner").opened.first);
  assert.equal(readExposure("owner").feedback.length, 1);
  await updateExposure(
    "other",
    async () => true,
    (old) => recordExposure(old, candidate("kept"), true, now),
  );
  await assert.rejects(
    updateExposure(
      "owner",
      async () => false,
      (old) => recordExposure(old, candidate("wrong"), true, now),
    ),
    /Account changed/,
  );
  assert.equal(readExposure("owner").opened.wrong, undefined);
  await deleteExposure("owner");
  await assert.rejects(
    updateExposure(
      "owner",
      async () => true,
      (old) => old,
    ),
  );
  assert.deepEqual(readExposure("owner").opened, {});
  assert.ok(readExposure("other").opened.kept);
});
