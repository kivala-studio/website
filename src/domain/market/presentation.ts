import { MARKET_MESSAGE_KEYS, type ReferenceMessageKey, type VerifiedClosingPrice } from "./models";
import { civilDate } from "./zone";

/** Why a BODIVA reference price is missing, as a message key. */
export function referenceUnavailableKey(reason: string | undefined): ReferenceMessageKey {
  switch (reason) {
    case "emptyHistory":
    case "no_official_history":
    case "empty_response":
      return "formatting.price.noTrades";
    case "missingProvenance":
    case "missing_provenance":
      return "formatting.price.provenanceUnconfirmed";
    case "sourceUnavailable":
    case "source_unavailable":
    case "timeout":
    case "source_failure":
      return "formatting.price.sourceNoResponse";
    case "invalidSource":
    case "invalid_response":
    case "symbol_mismatch":
    case "invalid_price":
    case "invalid_date":
      return "formatting.price.invalidResponse";
    case "rateLimited":
      return "formatting.price.rateLimited";
    case "notYetCollected":
      return "formatting.price.historyNotCollected";
    default:
      return "formatting.price.unconfirmed";
  }
}

/** The last reference update problem: a key, plus the reason key that follows its prefix. */
export function referenceUpdateIssue(
  status: string | undefined,
  reason: string | undefined,
): { key: ReferenceMessageKey; detailKey?: ReferenceMessageKey } | undefined {
  if (status === undefined || status === "verified") return undefined;
  if (status === "empty") return { key: "formatting.price.noNewPrices" };
  return { key: "formatting.price.referenceUpdate", detailKey: referenceUnavailableKey(reason) };
}

/** `Último fecho verificado · {arg1}` with the session's civil date for `arg1`. */
export const verifiedCloseLabel = (close: VerifiedClosingPrice) => ({
  key: MARKET_MESSAGE_KEYS.price.lastVerifiedClose,
  date: civilDate(close.tradingDate),
});
