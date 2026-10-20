import test from "node:test";
import assert from "node:assert/strict";
import {
  hydrateEdition,
  personalizationEdition,
} from "../app/resumos/edition.ts";
import {
  saveEdition,
  repairEdition,
  correctEdition,
  recordPlayback,
  assertArchive,
  archiveExpired,
} from "../lib/wrap-archive.ts";
import { wrapRows } from "../lib/wrap-evidence.ts";
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
test("saved recap survives live evidence expiry and ignores later holdings or market changes", () => {
  const original = edition();
  const archive = saveEdition(null, user, original, now);
  const changed = edition();
  changed.stories[0].title = "Changed today";
  assert.deepEqual(
    saveEdition(archive, user, changed, now + 86400000),
    archive,
  );
  assert.equal(
    wrapRows(original.source.evidence, period, securities, now + 86400000),
    null,
  );
  assert.equal(hydrateEdition(original, now + 86400000)[0].end, 110);
  original.stories[0].title = "Mutated after saving";
  assert.notEqual(
    archive.editions[0].stories[0].title,
    original.stories[0].title,
  );
});
test("watchlist repair appends an edition while preserving original market and portfolio stories", () => {
  const original = edition(),
    archive = saveEdition(null, user, original, now);
  const proposed = personalizationEdition(
    original,
    [asset],
    { evidence: evidence(), securities, capturedAt: now },
    now,
  );
  const next = repairEdition(archive, original.id, proposed, now);
  assert.equal(next.editions.length, 2);
  assert.deepEqual(next.editions[0], original);
  assert.ok(next.editions[1].stories.some((s) => s.id === "watchlist"));
  assert.deepEqual(
    next.editions[1].stories.filter((s) => s.id !== "watchlist"),
    original.stories,
  );
  assert.throws(() => repairEdition(next, original.id, proposed, now));
  const bad = structuredClone(proposed);
  bad.stories.find((s) => s.id === "portfolio").value = "9999 Kz";
  assert.throws(() => repairEdition(archive, original.id, bad, now));
  assert.throws(() =>
    personalizationEdition(
      original,
      [id(99)],
      { evidence: evidence(), securities, capturedAt: now },
      now,
    ),
  );
});
test("historical watchlist repair still requires fresh calendars and source quality", () => {
  const later = now + 7 * 86400000;
  assert.equal(wrapRows(evidence(later), period, securities, later), null);
  assert.equal(
    wrapRows(evidence(later), period, securities, later, "historical-repair")
      .length,
    1,
  );
  assert.equal(
    wrapRows(evidence(), period, securities, later, "historical-repair"),
    null,
  );
  const original = edition();
  assert.ok(
    personalizationEdition(
      original,
      [asset],
      { evidence: evidence(later), securities, capturedAt: later },
      later,
    ),
  );
});
test("correction receipts cannot change captured personal context or silently replace an edition", () => {
  const original = edition(),
    archive = saveEdition(null, user, original, now);
  const corrected = {
    ...edition(),
    edition: 2,
    correction: {
      supersedes: original.id,
      sourceRevision: "official-review-1",
      reason: "sourceCorrection",
      explanation: "Reviewed source correction",
      detectedAt: now,
    },
  };
  const next = correctEdition(archive, original.id, corrected, now);
  assert.equal(next.editions.length, 2);
  assert.deepEqual(correctEdition(next, original.id, corrected, now), next);
  assert.throws(() =>
    correctEdition(
      archive,
      original.id,
      { ...corrected, watchedIDs: [asset] },
      now,
    ),
  );
  assert.throws(() =>
    correctEdition(
      archive,
      original.id,
      {
        ...corrected,
        correction: { ...corrected.correction, sourceRevision: "" },
      },
      now,
    ),
  );
});
test("resume journals are edition-scoped, availability and completion are idempotent", () => {
  const original = edition();
  let archive = saveEdition(null, user, original, now);
  let result = recordPlayback(
    archive,
    original.id,
    "wrap_available",
    "portfolio",
    now,
  );
  assert.equal(result.accepted, true);
  assert.equal(
    recordPlayback(result.record, original.id, "wrap_available", null, now)
      .accepted,
    false,
  );
  archive = recordPlayback(
    result.record,
    original.id,
    "wrap_completed",
    "closing",
    now,
  ).record;
  assert.equal(
    recordPlayback(archive, original.id, "wrap_completed", null, now).accepted,
    false,
  );
  const proposed = personalizationEdition(
    original,
    [asset],
    { evidence: evidence(), securities, capturedAt: now },
    now,
  );
  const repaired = repairEdition(archive, original.id, proposed, now);
  result = recordPlayback(repaired, proposed.id, "wrap_opened", "opening", now);
  assert.equal(result.record.playback[proposed.id].completed, false);
  assert.equal(result.record.playback[original.id].storyID, "closing");
});
test("foreign accounts, damaged chains and tampered financial stories fail closed", () => {
  const original = edition(),
    archive = saveEdition(null, user, original, now);
  assert.throws(() => assertArchive(archive, id(999)));
  const invalid = structuredClone(archive);
  invalid.editions[0].edition = 2;
  assert.throws(() => assertArchive(invalid, user));
  original.stories.find((s) => s.id === "portfolio").personal = false;
  assert.throws(() => hydrateEdition(original));
  assert.equal(archiveExpired(archive, now + 729 * 86400000), false);
  assert.equal(archiveExpired(archive, now + 730 * 86400000), true);
});
