"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

import { MOVEMENT_SENSITIVITIES, type MovementSensitivity } from "@/domain/account/alerts";
import { CATEGORY_PREFERENCES, CONFIGURABLE_UNUSUAL_RULES, type CategoryPreference, type UnusualRule } from "@/domain/activity/preferences";
import { useAccountStores } from "@/features/account/account-provider";
import { OptionGroup } from "@/ui/components/controls";
import { SwitchRow } from "@/ui/components/menu";
import { SectionPlaceholder } from "@/ui/components/states";

const CATEGORY_LABELS: Record<CategoryPreference, string> = {
  watched_movements_enabled: "common.watchlistMovements",
  held_asset_movements_enabled: "settings.categories.holdingMovements",
  portfolio_daily_enabled: "settings.categories.portfolioDaily",
  listings_enabled: "settings.categories.newListings",
  daily_close_enabled: "settings.categories.dailyClose",
  public_previews_enabled: "settings.categories.publicFacts",
};

const RULE_LABELS: Record<(typeof CONFIGURABLE_UNUSUAL_RULES)[number], string> = {
  large_trade: "legacy.unusualactivityRuleLargeTrade",
  large_order: "legacy.unusualactivityRuleLargeOrder",
  volume_spike: "legacy.unusualactivityRuleVolumeSpike",
  trade_count_spike: "legacy.unusualactivityRuleTradeCountSpike",
  price_move: "legacy.unusualactivityRulePriceMove",
  dormancy_break: "legacy.unusualactivityRuleDormancyBreak",
  spread_change: "legacy.unusualactivityRuleSpreadChange",
};

const SENSITIVITY: Record<MovementSensitivity, string> = {
  low: "notifications.movementAlert.low",
  normal: "site.alerts.sensitivityNormal",
  high: "notifications.movementAlert.high",
};

/**
 * Settings → Notificações, shared with the apps: the six categories, the market recap opt-in, the movement
 * sensitivity and the unusual-activity switches. Each change applies at once and is saved in order.
 */
export function NotificationSettings() {
  const t = useTranslations();
  const stores = useAccountStores()!;
  const { preferences: store, watchlist } = stores;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const list = useSyncExternalStore(watchlist.subscribe, watchlist.getSnapshot, watchlist.getSnapshot);

  useEffect(() => {
    const controller = new AbortController();
    void store.load(controller.signal);
    void watchlist.load();
    return () => controller.abort();
  }, [store, watchlist]);

  const title = t("common.notifications");
  const preferences = state.preferences;
  if (!preferences) {
    return (
      <section aria-labelledby="notifications-title" className="flex flex-col gap-3">
        <h2 id="notifications-title" className="text-section text-primary-text">
          {title}
        </h2>
        <SectionPlaceholder title={title} failed={state.status === "failed"} onRetry={() => void store.load()} />
      </section>
    );
  }

  const rulesEnabled = preferences.unusual.enabled;
  return (
    <section aria-labelledby="notifications-title" className="flex max-w-2xl flex-col gap-6" data-testid="notification-settings">
      <h2 id="notifications-title" className="text-section text-primary-text">
        {title}
      </h2>
      <div className="flex flex-col">
        {CATEGORY_PREFERENCES.map((key) => (
          <SwitchRow
            key={key}
            label={t(CATEGORY_LABELS[key] as never)}
            checked={preferences.categories[key]}
            onChange={(value) => store.setCategory(key, value)}
            testID={`preference-${key}`}
          />
        ))}
        <SwitchRow label={t("settings.marketRecap.toggle")} checked={preferences.recaps} onChange={(value) => store.setRecaps(value)} testID="preference-recaps" />
        <p className="pt-2 text-caption text-secondary-text">{t("site.settings.notificationLimits")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body font-semibold text-primary-text">{t("settings.sensitivity.title")}</h3>
        <OptionGroup
          label={t("settings.sensitivity.title")}
          options={MOVEMENT_SENSITIVITIES.map((value) => ({ value, title: t(SENSITIVITY[value] as never), disabled: list.status !== "loaded" }))}
          value={list.sensitivity}
          onChange={(value) => watchlist.setSensitivity(value)}
        />
      </div>

      <div className="flex flex-col">
        <h3 className="pb-1 text-body font-semibold text-primary-text">{t("unusualActivity.title")}</h3>
        <SwitchRow
          label={t("unusualActivity.settings.notifications")}
          checked={rulesEnabled}
          onChange={(value) => store.setUnusualEnabled(value)}
          testID="preference-unusual"
        />
        {CONFIGURABLE_UNUSUAL_RULES.map((rule: UnusualRule) => (
          <SwitchRow
            key={rule}
            label={t(RULE_LABELS[rule as keyof typeof RULE_LABELS] as never)}
            checked={!preferences.unusual.disabledRules.includes(rule)}
            disabled={!rulesEnabled}
            onChange={(enabled) => store.setUnusualRule(rule, enabled)}
            testID={`preference-rule-${rule}`}
          />
        ))}
      </div>
    </section>
  );
}
