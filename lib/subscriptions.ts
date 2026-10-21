import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoryPoint } from "./history";

// Matches the native FreePlanLimits and the existing subscription RPC contract.
export const planLimits = {
  freeWatchlist: 3,
  freeMovement: 1,
  freeComparison: 2,
  plusWatchlist: 500,
  plusComparison: 3,
} as const;
export type SubscriptionAccess = {
  is_plus: boolean;
  enforcement_enabled: boolean;
  comparison_pair: string[] | null;
  resets_at: string;
};
function accessSnapshot(data: unknown): SubscriptionAccess {
  const value = data as Partial<SubscriptionAccess> | null;
  if (
    !value ||
    typeof value.is_plus !== "boolean" ||
    typeof value.enforcement_enabled !== "boolean" ||
    typeof value.resets_at !== "string" ||
    !Number.isFinite(Date.parse(value.resets_at)) ||
    !(
      value.comparison_pair === null ||
      (Array.isArray(value.comparison_pair) &&
        value.comparison_pair.length === 2 &&
        value.comparison_pair.every((id) => typeof id === "string"))
    )
  ) {
    throw new Error("SUBSCRIPTION_UNAVAILABLE");
  }
  return value as SubscriptionAccess;
}
export async function getSubscriptionAccess(
  client: SupabaseClient,
): Promise<SubscriptionAccess> {
  const { data, error } = await client.rpc("get_subscription_access");
  if (error) throw error;
  return accessSnapshot(data);
}

/** Never spend a weekly pair on a preview, failed history, or unusable selected period. */
export async function prepareComparison(
  client: SupabaseClient,
  owner: string,
  ids: [string, string],
  loadHistory: (id: string) => Promise<HistoryPoint[]>,
  cutoff: number,
) {
  if (!owner || !ids[0] || !ids[1] || ids[0] === ids[1])
    throw new Error("INVALID_COMPARISON");
  const histories = await Promise.all(ids.map(loadHistory));
  const dates = histories.map(
    (rows) =>
      new Set(
        rows
          .filter(
            (p) =>
              Number.isFinite(p.close_price) &&
              p.close_price > 0 &&
              Date.parse(p.trading_date) >= cutoff,
          )
          .map((p) => p.trading_date),
      ),
  );
  if ([...dates[0]].filter((day) => dates[1].has(day)).length < 2)
    throw new Error("COMPARISON_DATA_UNAVAILABLE");
  const { data: account, error: authError } = await client.auth.getUser();
  if (authError || account.user?.id !== owner)
    throw new Error("COMPARISON_SIGN_IN_REQUIRED");
  // The server derives the account and Plus entitlement, canonicalises the pair,
  // and applies the Luanda calendar-week quota atomically. No local override.
  const { data, error } = await client.rpc("authorize_chart_comparison", {
    security_ids: ids,
  });
  if (error) throw error;
  return { histories, access: accessSnapshot(data) };
}
export function subscriptionMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const messages: Record<string, string> = {
    FREE_WATCHLIST_LIMIT: `O plano gratuito permite guardar ${planLimits.freeWatchlist} instrumentos. Remove um instrumento ou consulta o Plus.`,
    FREE_MOVEMENT_LIMIT:
      "O plano gratuito permite movimentos automáticos de um instrumento. Desactiva outro ou consulta o Plus.",
    FREE_COMPARISON_SIZE_LIMIT:
      "O plano gratuito permite comparar dois instrumentos. Consulta as opções do Plus.",
    FREE_COMPARISON_WEEK_LIMIT:
      "Já escolheste o par desta semana. Podes reabri-lo ou escolher outro na segunda-feira, às 00:00 de Luanda. O Plus não tem limite semanal.",
    COMPARISON_DATA_UNAVAILABLE:
      "Não existem dois fechos comuns utilizáveis neste período. A tua comparação gratuita não foi utilizada.",
    COMPARISON_SIGN_IN_REQUIRED:
      "A tua sessão mudou. Inicia sessão novamente antes de comparar.",
    INVALID_COMPARISON:
      "Selecciona dois instrumentos diferentes e do mesmo tipo.",
  };
  return (
    messages[code] ||
    "Não foi possível confirmar o acesso ou concluir a operação. Tenta novamente; os limites do plano mantêm-se."
  );
}
