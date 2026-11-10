import { AppError } from "../errors/app-error";
import { mapError } from "../errors/map";
import { type EpochMs, SECOND_MS } from "./zone";

/** Seconds the direct reads replace the shared snapshot after a server failure. */
export const SNAPSHOT_SERVER_FAILURE_PAUSE_SECONDS = 300;

/**
 * Chooses between the shared snapshot and the direct reads for every market read in the tab.
 * After a snapshot server failure (5xx, gateway, timeout) refreshes read directly until the pause
 * ends, then probe the snapshot again; one refresh never sends both.
 */
export class SnapshotRoute {
  private directUntil: EpochMs | undefined;

  constructor(private readonly pauseSeconds = SNAPSHOT_SERVER_FAILURE_PAUSE_SECONDS) {}

  static isServerFailure(error: unknown): boolean {
    const mapped = error instanceof AppError ? error : mapError(error, "market.snapshot");
    if (!mapped) return false;
    if (mapped.httpStatus !== null) return mapped.httpStatus >= 500;
    return mapped.category === "timeout" || mapped.category === "serviceUnavailable";
  }

  usesSnapshot(now: EpochMs): boolean {
    return this.directUntil === undefined || now >= this.directUntil;
  }

  recordServerFailure(now: EpochMs): void {
    this.directUntil = now + this.pauseSeconds * SECOND_MS;
  }
}
