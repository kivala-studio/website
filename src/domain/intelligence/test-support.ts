import type Decimal from "decimal.js";

import { type CalendarException, MarketCalendar } from "../market/calendar";
import type { PriceObservation } from "../market/history-validation";
import { VALID_QUALITY } from "../market/quality";
import type { EpochMs } from "../market/zone";
import { Dec } from "./math";

/** Shared fixtures for the intelligence ports (iOS test helpers). */

export const iso = (value: string): EpochMs => Date.parse(value);
export const d = (value: string | number) => new Dec(value);

/** Luanda midnight of 2026-09-`day`. */
export const septemberDay = (day: number): EpochMs => Date.UTC(2026, 8, day) - 3_600_000;

export function fixtureCalendar(options: {
  version: string;
  coverage: { start: EpochMs; endExclusive: EpochMs };
  verifiedAt: EpochMs;
  validUntil: EpochMs;
  exceptions?: ReadonlyMap<EpochMs, CalendarException> | [EpochMs, CalendarException][];
}): MarketCalendar {
  return new MarketCalendar({
    version: options.version,
    coverage: options.coverage,
    verifiedAt: options.verifiedAt,
    validUntil: options.validUntil,
    normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 + 30 },
    exceptions: new Map(options.exceptions ?? []),
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
}

export function observation(fields: {
  recordID: string;
  assetID: string;
  price: Decimal;
  observedAt: EpochMs;
  collectedAt?: EpochMs;
  currencyCode?: string;
  dataset?: string;
  ingestionRunID: string;
  parserVersion?: string;
  isFinal?: boolean;
}): PriceObservation {
  return {
    recordID: fields.recordID,
    assetID: fields.assetID,
    currencyCode: fields.currencyCode ?? "AOA",
    price: fields.price,
    observedAt: fields.observedAt,
    collectedAt: fields.collectedAt ?? fields.observedAt + 60_000,
    source: {
      dataset: fields.dataset ?? "price_history.close_price",
      ingestionRunID: fields.ingestionRunID,
      contentHash: "a".repeat(64),
      parserVersion: fields.parserVersion ?? "fixture",
    },
    isFinal: fields.isFinal ?? true,
    dataQuality: VALID_QUALITY,
  };
}
