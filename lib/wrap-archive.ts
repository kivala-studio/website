import type { Security } from "./public-data";
import type { Transaction } from "./account-data";
import type { WrapEvidence, WrapWindow } from "./wrap-evidence";
import type { Story } from "../app/resumos/content";

export type WrapSource = {
  evidence: WrapEvidence;
  securities: Security[];
  capturedAt: number;
};
export type WrapEdition = {
  id: string;
  edition: number;
  compositionVersion: 1;
  createdAt: number;
  period: WrapWindow;
  source: WrapSource;
  watchSource?: WrapSource;
  watchedIDs: string[];
  transactions: Transaction[];
  stories: Story[];
  portfolioOmission: string;
  repair?: { supersedes: string; capturedAt: number };
  correction?: {
    supersedes: string;
    sourceRevision: string;
    reason: "sourceCorrection" | "calculationCorrection" | "methodologyUpgrade";
    explanation: string;
    detectedAt: number;
  };
};
export type WrapEvent =
  | "wrap_available"
  | "wrap_opened"
  | "wrap_completed"
  | "wrap_abandoned"
  | "wrap_shared";
export type WrapPlayback = {
  storyID: string | null;
  completed: boolean;
  updatedAt: number;
  events: Partial<Record<WrapEvent, number>>;
};
export type WrapArchive = {
  schema: 1;
  userID: string;
  key: string;
  editions: WrapEdition[];
  playback: Record<string, WrapPlayback>;
  unavailable?: string;
};
export const periodKey = (period: WrapWindow) =>
  `${period.period_type}-${period.starts_on}`;
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const day = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function validPeriodKey(key: string) {
  const match = /^(weekly|monthly)-(\d{4}-\d{2}-\d{2})$/.exec(key);
  return (
    !!match &&
    day(match[2]) &&
    (match[1] === "weekly"
      ? new Date(`${match[2]}T12:00:00Z`).getUTCDay() === 1
      : match[2].endsWith("-01"))
  );
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function assertArchive(
  input: unknown,
  userID: string,
  key?: string,
): asserts input is WrapArchive {
  const a = input as WrapArchive;
  if (
    !a ||
    a.schema !== 1 ||
    a.userID !== userID ||
    !uuid(userID) ||
    !validPeriodKey(a.key) ||
    (key && a.key !== key) ||
    !Array.isArray(a.editions) ||
    !a.editions.length ||
    !a.playback ||
    typeof a.playback !== "object"
  )
    throw new Error("Unsupported or damaged archive");
  const ids = new Set<string>();
  for (let i = 0; i < a.editions.length; i++) {
    const e = a.editions[i];
    if (
      !e ||
      !uuid(e.id) ||
      ids.has(e.id) ||
      e.edition !== i + 1 ||
      e.compositionVersion !== 1 ||
      !Number.isFinite(e.createdAt) ||
      !e.period ||
      periodKey(e.period) !== a.key ||
      canonical(e.period) !== canonical(a.editions[0].period) ||
      !e.source ||
      !Array.isArray(e.source.securities) ||
      !e.source.evidence ||
      !Number.isFinite(e.source.capturedAt) ||
      !Array.isArray(e.stories) ||
      !e.stories.length ||
      new Set(e.stories.map((s) => s.id)).size !== e.stories.length ||
      e.stories.some(
        (s) =>
          !s.id ||
          typeof s.title !== "string" ||
          typeof s.value !== "string" ||
          typeof s.body !== "string",
      ) ||
      !Array.isArray(e.transactions) ||
      !Array.isArray(e.watchedIDs) ||
      e.watchedIDs.some((id) => !uuid(id))
    )
      throw new Error("Invalid edition");
    if (
      i === 0
        ? !!e.repair || !!e.correction
        : !!e.repair === !!e.correction ||
          (e.repair?.supersedes ?? e.correction?.supersedes) !==
            a.editions[i - 1].id
    )
      throw new Error("Invalid edition chain");
    ids.add(e.id);
  }
}
export function archiveExpired(record: WrapArchive, now: number) {
  return (
    now >=
    record.editions[0].createdAt +
      (record.key.startsWith("weekly-") ? 730 : 56) * 86400000
  );
}
export function saveEdition(
  existing: WrapArchive | null,
  userID: string,
  edition: WrapEdition,
  now: number,
): WrapArchive {
  if (existing) {
    assertArchive(existing, userID, periodKey(edition.period));
    return existing;
  }
  const record: WrapArchive = {
    schema: 1,
    userID,
    key: periodKey(edition.period),
    editions: [structuredClone(edition)],
    playback: {},
  };
  assertArchive(record, userID);
  if (edition.createdAt > now || archiveExpired(record, now))
    throw new Error("Invalid generation time");
  return record;
}
/** Only deliberate watchlist repair can change membership. All other pages stay frozen. */
export function repairEdition(
  record: WrapArchive,
  expectedID: string,
  proposal: WrapEdition,
  now: number,
): WrapArchive {
  assertArchive(record, record.userID);
  const old = record.editions.at(-1)!;
  if (
    record.unavailable ||
    archiveExpired(record, now) ||
    old.id !== expectedID ||
    proposal.repair?.supersedes !== expectedID ||
    proposal.correction ||
    !proposal.watchSource ||
    !Number.isFinite(Date.parse(proposal.watchSource.evidence.fetched_at)) ||
    Date.parse(proposal.watchSource.evidence.fetched_at) > now ||
    now - Date.parse(proposal.watchSource.evidence.fetched_at) >= 900000 ||
    proposal.repair.capturedAt > now ||
    now - proposal.repair.capturedAt >= 900000 ||
    proposal.watchSource.capturedAt > now ||
    now - proposal.watchSource.capturedAt >= 900000 ||
    proposal.createdAt > now
  )
    throw new Error("The saved edition changed or evidence expired");
  if (
    canonical(old.source) !== canonical(proposal.source) ||
    canonical(old.transactions) !== canonical(proposal.transactions) ||
    old.portfolioOmission !== proposal.portfolioOmission ||
    canonical(old.stories.filter((s) => s.id !== "watchlist")) !==
      canonical(proposal.stories.filter((s) => s.id !== "watchlist"))
  )
    throw new Error("Repair changed original market or portfolio history");
  if (
    canonical(old.watchedIDs) === canonical(proposal.watchedIDs) &&
    canonical(old.stories.filter((s) => s.id === "watchlist")) ===
      canonical(proposal.stories.filter((s) => s.id === "watchlist"))
  )
    return record;
  const next = structuredClone(record);
  next.editions.push(proposal);
  assertArchive(next, record.userID);
  return next;
}
/** A correction requires an authoritative receipt, never a changed fetch timestamp. */
export function correctEdition(
  record: WrapArchive,
  expectedID: string,
  proposal: WrapEdition,
  now: number,
): WrapArchive {
  assertArchive(record, record.userID);
  const old = record.editions.at(-1)!,
    receipt = proposal.correction;
  if (
    !receipt ||
    !receipt.explanation.trim() ||
    !receipt.sourceRevision.trim() ||
    ![
      "sourceCorrection",
      "calculationCorrection",
      "methodologyUpgrade",
    ].includes(receipt.reason) ||
    receipt.detectedAt > now ||
    !Number.isFinite(receipt.detectedAt) ||
    proposal.createdAt > now ||
    proposal.repair ||
    archiveExpired(record, now)
  )
    throw new Error("Invalid correction receipt");
  const duplicate = record.editions.find(
    (e) => e.correction?.sourceRevision === receipt.sourceRevision,
  );
  if (duplicate) {
    if (
      record.unavailable ||
      canonical(duplicate.stories) !== canonical(proposal.stories)
    )
      throw new Error("Conflicting correction receipt");
    return record;
  }
  if (
    old.id !== expectedID ||
    receipt.supersedes !== expectedID ||
    canonical(old.watchedIDs) !== canonical(proposal.watchedIDs) ||
    canonical(old.transactions) !== canonical(proposal.transactions) ||
    canonical(old.source.securities) !== canonical(proposal.source.securities)
  )
    throw new Error("Correction changed captured personal context");
  const next = structuredClone(record);
  next.editions.push(proposal);
  delete next.unavailable;
  assertArchive(next, record.userID);
  return next;
}
export function recordPlayback(
  record: WrapArchive,
  editionID: string,
  event: WrapEvent | null,
  storyID: string | null,
  now: number,
) {
  assertArchive(record, record.userID);
  const edition = record.editions.find((e) => e.id === editionID);
  if (
    !edition ||
    record.unavailable ||
    archiveExpired(record, now) ||
    (storyID && !edition.stories.some((s) => s.id === storyID))
  )
    throw new Error("Unavailable edition");
  const next = structuredClone(record);
  const previous = edition.correction
    ? next.playback[edition.correction.supersedes]
    : null;
  const state = next.playback[editionID] ?? {
    storyID: null,
    completed: previous?.completed ?? false,
    updatedAt: now,
    events: {},
  };
  const accepted =
    !!event &&
    !(event === "wrap_available" && state.events.wrap_available) &&
    !(event === "wrap_completed" && state.completed);
  if (storyID) state.storyID = storyID;
  if (accepted && event)
    state.events[event] = Math.min(1000, (state.events[event] || 0) + 1);
  if (event === "wrap_completed") state.completed = true;
  state.updatedAt = now;
  next.playback[editionID] = state;
  return { record: next, accepted };
}
