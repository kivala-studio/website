"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Whether this component mounted after the page came to life (a client-side change: data arrived, a state swapped,
 * a client navigation), so its entrance may animate (`motion-fade-in`, `motion-presence`). Server-rendered and
 * hydrated content reads `false` for its whole life, so nothing fades in on load or delays the first paint. Decided
 * once, at mount: React reads the server snapshot while hydrating and the client one for anything mounted later.
 */
export function useEntrance(): boolean {
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  const [entrance] = useState(!hydrating);
  return entrance;
}
