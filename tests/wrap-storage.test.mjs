import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  mutateArchive,
  listArchives,
  deleteAccountArchives,
} from "../lib/wrap-storage.ts";
import {
  periodKey,
  saveEdition,
  repairEdition,
  recordPlayback,
} from "../lib/wrap-archive.ts";
import { personalizationEdition } from "../app/resumos/edition.ts";
import {
  id,
  user,
  asset,
  now,
  period,
  securities,
  evidence,
  edition,
} from "./fixtures/wrap.mjs";

test("IndexedDB serializes competing repairs and preserves the original edition", async () => {
  const original = edition(),
    owner = id(200);
  await mutateArchive(owner, periodKey(period), (old) =>
    saveEdition(old, owner, original, now),
  );
  const first = personalizationEdition(
    original,
    [asset],
    { evidence: evidence(), securities, capturedAt: now },
    now,
  );
  const second = { ...first, id: crypto.randomUUID() };
  const results = await Promise.allSettled(
    [first, second].map((proposal) =>
      mutateArchive(owner, periodKey(period), (old) =>
        repairEdition(old, original.id, proposal, now),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const [saved] = await listArchives(owner);
  assert.equal(saved.editions.length, 2);
  assert.deepEqual(saved.editions[0], original);
  await deleteAccountArchives(owner);
});
test("concurrent playback updates retain both counters; deleting one account preserves another", async () => {
  const original = edition(),
    another = id(100);
  for (const owner of [user, another])
    await mutateArchive(owner, periodKey(period), (old) =>
      saveEdition(old, owner, original, now),
    );
  await Promise.all(
    ["wrap_opened", "wrap_shared"].map((event) =>
      mutateArchive(
        user,
        periodKey(period),
        (old) => recordPlayback(old, original.id, event, "opening", now).record,
      ),
    ),
  );
  const [saved] = await listArchives(user);
  assert.deepEqual(saved.playback[original.id].events, {
    wrap_opened: 1,
    wrap_shared: 1,
  });
  await deleteAccountArchives(user);
  assert.deepEqual(await listArchives(user), []);
  await assert.rejects(() =>
    mutateArchive(user, periodKey(period), (old) =>
      saveEdition(old, user, original, now),
    ),
  );
  assert.equal((await listArchives(another)).length, 1);
  await assert.rejects(() =>
    mutateArchive(another, periodKey(period), () => saved),
  );
  assert.equal((await listArchives(another))[0].userID, another);
  await deleteAccountArchives(another);
});
