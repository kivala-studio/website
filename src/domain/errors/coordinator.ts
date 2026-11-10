import type { AppError } from "./app-error";
import { mapError } from "./map";
import { presentError, type ErrorContext, type ErrorPresentation } from "./presentation";

export type RetryAction = () => unknown;

export type ErrorEntry = {
  /** The operation name; one entry per operation, latest wins. */
  readonly id: string;
  readonly version: number;
  readonly error: AppError;
  readonly presentation: ErrorPresentation;
  /** Null when the failure cannot be retried. */
  readonly retry: RetryAction | null;
};

export type ErrorCoordinatorState = {
  readonly entries: readonly ErrorEntry[];
  readonly isRetrying: boolean;
  readonly requiresAuthentication: boolean;
};

export type PresentOptions = {
  context?: ErrorContext;
  retry?: RetryAction;
  /** An aborted signal means the work was cancelled: nothing is presented. */
  signal?: AbortSignal;
};

/**
 * Shared failure state for stores. Shows one cause group at a time; retries run only when the
 * user asks (`retryCurrent`), each failed operation once, serially. Nothing retries on its own.
 * `subscribe`/`getSnapshot` fit `useSyncExternalStore`.
 */
export class ErrorCoordinator {
  private state: ErrorCoordinatorState = { entries: [], isRetrying: false, requiresAuthentication: false };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private nextVersion = 0;

  /** `record` receives every mapped failure (telemetry); it must not log `cause`. */
  constructor(private readonly record: (error: AppError) => void = () => {}) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): ErrorCoordinatorState => this.state;

  get entries(): readonly ErrorEntry[] {
    return this.state.entries;
  }

  get current(): ErrorEntry | null {
    return this.state.entries[0] ?? null;
  }

  get isRetrying(): boolean {
    return this.state.isRetrying;
  }

  /** Set by a failure that needs sign-in; cleared by `reset` after sign-out or re-authentication. */
  get requiresAuthentication(): boolean {
    return this.state.requiresAuthentication;
  }

  /** Maps and records a failure without showing it. */
  handle(error: unknown, operation: string, signal?: AbortSignal): AppError | null {
    if (signal?.aborted) return null;
    const mapped = mapError(error, operation);
    if (!mapped) return null;
    this.record(mapped);
    if (mapped.requiresAuthentication) this.update({ requiresAuthentication: true, entries: [] });
    return mapped;
  }

  present(error: unknown, operation: string, { context = "action", retry, signal }: PresentOptions = {}): void {
    const mapped = this.handle(error, operation, signal);
    if (!mapped || this.state.requiresAuthentication) return;
    const entry: ErrorEntry = {
      id: operation,
      version: this.nextVersion++,
      error: mapped,
      presentation: presentError(mapped, context),
      retry: mapped.userCanRetry ? (retry ?? null) : null,
    };
    const entries = [...this.state.entries];
    const index = entries.findIndex((existing) => existing.id === operation);
    if (index === -1) entries.push(entry);
    else entries[index] = entry;
    this.update({ entries });
  }

  /** User-initiated: retries each failed operation of the visible cause group once, serially. */
  async retryCurrent(): Promise<void> {
    const cause = this.current?.error.causeGroup;
    if (this.state.isRetrying || cause === undefined) return;
    this.update({ isRetrying: true });
    const token = this.generation;
    try {
      const group = this.state.entries.filter((entry) => entry.error.causeGroup === cause);
      for (const entry of group) {
        if (this.state.requiresAuthentication) return;
        if (token !== this.generation || !entry.retry) continue;
        try {
          await entry.retry();
          if (token !== this.generation) return;
          this.update({
            entries: this.state.entries.filter((other) => other.id !== entry.id || other.version !== entry.version),
          });
        } catch (error) {
          if (token !== this.generation) return;
          this.present(error, entry.id, { retry: entry.retry });
        }
      }
    } finally {
      if (token === this.generation) this.update({ isRetrying: false });
    }
  }

  resolve(operation: string): void {
    this.update({ entries: this.state.entries.filter((entry) => entry.id !== operation) });
  }

  dismissCurrent(): void {
    const cause = this.current?.error.causeGroup;
    if (this.state.isRetrying || cause === undefined) return;
    this.update({ entries: this.state.entries.filter((entry) => entry.error.causeGroup !== cause) });
  }

  /** After sign-out or re-authentication; also invalidates any retry in flight. */
  reset(): void {
    this.generation += 1;
    this.update({ entries: [], isRetrying: false, requiresAuthentication: false });
  }

  private update(patch: Partial<ErrorCoordinatorState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
