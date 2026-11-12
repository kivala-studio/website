import type { Format, Translate } from "../format";
import { type ActivityItem, type DailyCloseFacts, isMasked } from "./activity";

/**
 * The daily close summary (iOS `DailyCloseCopy`) in the page's language. The stored composition is Portuguese;
 * the facts render again here, and the watchlist line is added in the app only (`personal`).
 */
export function dailyCloseCopy(facts: DailyCloseFacts, personal: boolean, t: Translate, format: Format): { title: string; body: string } {
  let body =
    facts.topSymbol && facts.topChangePercent
      ? t("notification.close.body", {
          arg1: format.count(facts.advancers),
          arg2: format.count(facts.decliners),
          arg3: facts.topSymbol,
          arg4: format.number(facts.topChangePercent, { digits: 2, signed: true }),
        })
      : t("notification.close.flat");
  if (personal && (facts.watchedCount ?? 0) > 0) {
    body += ` ${t("notification.close.watchlist", { arg1: format.count(facts.watchedAdvancers ?? 0), arg2: format.count(facts.watchedDecliners ?? 0) })}`;
  }
  return { title: t("notification.close.title"), body };
}

export interface ActivityText {
  readonly title: string;
  readonly body: string;
  readonly accessibilityText: string;
}

/**
 * What one row says. Alerts never show their threshold: the inbox names the instrument and points to it. With
 * privacy mode on, non-public rows keep only a generic title.
 */
export function activityText(
  item: ActivityItem,
  { t, format, symbolOf, privacyMode }: { t: Translate; format: Format; symbolOf: (securityID: string) => string | undefined; privacyMode: boolean },
): ActivityText {
  const plain = (title: string, body: string) => ({ title, body, accessibilityText: `${title}. ${body}` });
  if (isMasked(item, privacyMode)) return plain(t("common.newInformationNotification"), t("notifications.privacy.hiddenContent"));
  const { copy } = item;
  switch (copy.kind) {
    case "unavailable":
      return plain(t("common.informationUnavailable"), t("intelligence.activity.unavailableMessage"));
    case "dailyClose": {
      const close = dailyCloseCopy(copy.facts, true, t, format);
      return plain(close.title, close.body);
    }
    case "alert": {
      const symbol = copy.symbol ?? (item.destination.kind === "instrument" ? symbolOf(item.destination.securityID) : undefined);
      const heading = t("intelligence.priceAlert.triggeredTitle");
      return plain(symbol ? `${symbol} · ${heading}` : heading, t("intelligence.priceAlert.openMessage"));
    }
    case "composition":
      return { title: copy.title, body: copy.body, accessibilityText: copy.accessibilityText ?? `${copy.title}. ${copy.body}` };
  }
}
