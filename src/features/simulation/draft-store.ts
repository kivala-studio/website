"use client";

import { useCallback, useSyncExternalStore } from "react";

import { EMPTY_DRAFT, type SimulationDraft } from "@/domain/simulation/simulation";

/*
 * iOS keeps the draft in memory for the signed-in session and clears it when the account changes. Here it lives
 * in this tab's session storage under the account id, so a reload keeps it and another account never sees it.
 * The entered values never leave the browser.
 */
const PREFIX = "investao.simulation.draft.";
const listeners = new Set<() => void>();
const memory = new Map<string, SimulationDraft>();
const cache = new Map<string, { text: string | null; draft: SimulationDraft }>();

const FIELDS = ["initialInvestment", "monthlyContribution", "annualReturnPercent", "durationMonths"] as const;

function decode(text: string | null): SimulationDraft | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!FIELDS.every((field) => typeof record[field] === "string")) return null;
    const securityId = typeof record.securityId === "string" ? record.securityId : null;
    return {
      ...(Object.fromEntries(FIELDS.map((field) => [field, record[field]])) as Omit<SimulationDraft, "securityId">),
      securityId,
    };
  } catch {
    return null;
  }
}

function read(userID: string): SimulationDraft {
  let text: string | null = null;
  try {
    text = window.sessionStorage.getItem(PREFIX + userID);
  } catch {
    // Storage refused: the in-memory copy still holds for this page.
  }
  const cached = cache.get(userID);
  if (cached && cached.text === text) return cached.draft;
  const draft = decode(text) ?? memory.get(userID) ?? EMPTY_DRAFT;
  cache.set(userID, { text, draft });
  return draft;
}

function write(userID: string, draft: SimulationDraft) {
  memory.set(userID, draft);
  const text = JSON.stringify(draft);
  cache.set(userID, { text, draft });
  try {
    window.sessionStorage.setItem(PREFIX + userID, text);
  } catch {
    cache.set(userID, { text: null, draft });
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The account's draft and a setter; the empty draft before hydration. */
export function useSimulationDraft(userID: string) {
  const draft = useSyncExternalStore(
    subscribe,
    () => read(userID),
    () => EMPTY_DRAFT,
  );
  const update = useCallback((change: Partial<SimulationDraft>) => write(userID, { ...read(userID), ...change }), [userID]);
  return [draft, update] as const;
}
