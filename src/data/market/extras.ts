import type { MarketCalendarResponse, MarketClientControl, MarketPulseRow } from "@/domain/market";
import type { EpochMs } from "@/domain/market/zone";

interface Entry {
  readonly generatedAt: EpochMs;
  readonly freshUntil: EpochMs;
  readonly pulse?: readonly MarketPulseRow[];
  readonly calendar?: MarketCalendarResponse;
}

/**
 * Pulse, calendar and control bundled with the shared snapshot (iOS `MarketSnapshotExtras`). Until
 * `fresh_until` they replace their own reads; `control` stays until a newer bundle replaces it.
 */
export class SnapshotExtras {
  private entry: Entry | undefined;
  private latestControl: MarketClientControl | undefined;

  get control(): MarketClientControl | undefined {
    return this.latestControl;
  }

  store(entry: Entry, control: MarketClientControl | undefined): void {
    if (this.entry && entry.generatedAt < this.entry.generatedAt) return;
    this.entry = entry;
    if (control) this.latestControl = control;
  }

  pulse(now: EpochMs): readonly MarketPulseRow[] | undefined {
    return this.fresh(now)?.pulse;
  }

  calendar(startsOn: string, endsOn: string, now: EpochMs): { row: MarketCalendarResponse; freshUntil: EpochMs } | undefined {
    const entry = this.fresh(now);
    const row = entry?.calendar;
    if (!entry || !row || row.startsOn !== startsOn || row.endsOn !== endsOn) return undefined;
    return { row, freshUntil: entry.freshUntil };
  }

  private fresh(now: EpochMs): Entry | undefined {
    return this.entry && now < this.entry.freshUntil ? this.entry : undefined;
  }
}
