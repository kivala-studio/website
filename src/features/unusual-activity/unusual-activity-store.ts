import { type UnusualEvent, decodeUnusualEvents } from "@/domain/unusual-activity/unusual-activity";

export type UnusualActivitySnapshot = {
  readonly status: "loading" | "loaded" | "failed";
  readonly events: readonly UnusualEvent[];
  readonly refreshing: boolean;
};

/** Reads `/api/market/unusual-activity`; a failed refresh keeps what is showing (iOS `UnusualActivityStore.load`). */
export class UnusualActivityStore {
  private state: UnusualActivitySnapshot = { status: "loading", events: [], refreshing: false };
  private readonly listeners = new Set<() => void>();
  private request: AbortController | null = null;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<UnusualActivitySnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  readonly load = async () => {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.set({ refreshing: true });
    try {
      const response = await fetch("/api/market/unusual-activity", { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error(String(response.status));
      const body: unknown = await response.json();
      const rows = typeof body === "object" && body !== null ? (body as { rows?: unknown }).rows : undefined;
      if (!Array.isArray(rows)) throw new Error("rows");
      this.set({ status: "loaded", events: decodeUnusualEvents(rows), refreshing: false });
    } catch {
      if (request.signal.aborted) return;
      this.set({ status: this.state.status === "loaded" ? "loaded" : "failed", refreshing: false });
    }
  };

  cancel() {
    this.request?.abort();
    this.request = null;
  }
}
