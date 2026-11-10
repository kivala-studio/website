import type { MarketStore } from "./store";

/**
 * Feeds connectivity changes to the store (iOS `MarketConnectivityMonitor`). `nextPath` resolves
 * with the next state (`true` offline) or `null` when the source closes. A reconnect starts one
 * recovery refresh; an event that arrives after `signal` aborted is ignored.
 */
export async function observeConnectivity(
  nextPath: () => Promise<boolean | null>,
  store: MarketStore,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const offline = await nextPath();
    if (offline === null || signal.aborted) return;
    const reconnecting = store.getSnapshot().isOffline && !offline;
    store.setConnectivity(offline);
    // Concurrent recoveries join the store's single in-flight load.
    if (reconnecting) void store.refreshIfNeeded();
  }
}

/** Browser connectivity as a `nextPath` source: `online`/`offline` events, ended by `signal`. */
export function browserConnectivity(signal: AbortSignal): () => Promise<boolean | null> {
  const queue: boolean[] = [];
  let waiter: ((offline: boolean | null) => void) | undefined;
  const push = (offline: boolean) => {
    if (waiter) {
      const resolve = waiter;
      waiter = undefined;
      resolve(offline);
    } else queue.push(offline);
  };
  const online = () => push(false);
  const offline = () => push(true);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  if (!navigator.onLine) queue.push(true);
  signal.addEventListener(
    "abort",
    () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      waiter?.(null);
      waiter = undefined;
    },
    { once: true },
  );
  return () =>
    signal.aborted
      ? Promise.resolve(null)
      : queue.length > 0
        ? Promise.resolve(queue.shift()!)
        : new Promise((resolve) => {
            waiter = resolve;
          });
}
