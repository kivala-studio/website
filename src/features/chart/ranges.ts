import type { TimeRange } from "@/domain/market";
import type { TimeRange as RangeName } from "@/ui/components/controls";

/** The picker's chip names and the domain's ranges (`1D · 1S · 1M · 3M · 6M · 1A · Tudo`). */
export const RANGE_OF: Record<RangeName, TimeRange> = {
  oneDay: "1D",
  oneWeek: "1S",
  oneMonth: "1M",
  threeMonths: "3M",
  sixMonths: "6M",
  oneYear: "1A",
  all: "Tudo",
};

export const RANGE_NAMES = Object.keys(RANGE_OF) as RangeName[];
