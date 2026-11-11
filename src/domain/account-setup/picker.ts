import { MARKET_CATEGORIES, type MarketCategory, categoryIncludesKind, compareText } from "../market/discovery";
import { foldText } from "../market/classification";
import type { SecurityKind } from "../market/models";

/** An instrument as the first-watchlist picker lists it. */
export interface PickerInstrument {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly issuer: string;
  readonly kind: SecurityKind;
}

/** Without a search the picker shows this many, in name order (iOS). */
export const PICKER_DEFAULT_COUNT = 8;

/** `Todos` plus only the categories that have instruments. */
export const pickerCategories = (instruments: readonly PickerInstrument[]): MarketCategory[] =>
  MARKET_CATEGORIES.filter((category) => category === "all" || instruments.some((item) => categoryIncludesKind(category, item.kind)));

/** Category filter, then symbol / name / issuer search over the whole catalogue, in name order. */
export function pickerResults(instruments: readonly PickerInstrument[], search: string, category: MarketCategory): PickerInstrument[] {
  const query = foldText(search.trim());
  const matches = instruments
    .filter((item) => categoryIncludesKind(category, item.kind))
    .filter((item) => query === "" || [item.symbol, item.name, item.issuer].some((text) => foldText(text).includes(query)))
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.symbol, b.symbol));
  return query === "" ? matches.slice(0, PICKER_DEFAULT_COUNT) : matches;
}
