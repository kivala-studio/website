"use client";

import { useSyncExternalStore } from "react";

/*
 * The portfolio selection, remembered in this browser (iOS keeps it on the device). An id that no longer
 * exists falls back to the combined view where it is read (`resolveSelection`).
 */
const KEY = "investao.portfolio.selection";
const listeners = new Set<() => void>();
let memory: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function setPortfolioSelection(value: string) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Private windows may refuse storage; the choice still holds for this page.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The stored selection, or null before hydration and when none was made. */
export const useStoredSelection = () => useSyncExternalStore(subscribe, read, () => null);
