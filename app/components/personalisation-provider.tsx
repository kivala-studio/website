"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAccount } from "./account-provider";
import { useClock } from "./use-clock";
import { useResource } from "./async-state";
import { ledger, watchlist } from "../../lib/account-data";
import { positions } from "../../lib/finance";
import {
  activityDay,
  aggregateKey,
  behavioralInterest,
  emptyInterests,
  isUUID,
  validActivity,
  type ActivityAggregate,
  type ActivityEvent,
  type InterestProfile,
} from "../../lib/personalisation";

type Personalisation = {
  profile: InterestProfile;
  ready: boolean;
  error: boolean;
  record: (event: ActivityEvent) => void;
  refresh: () => void;
  resetBehavior: () => Promise<boolean>;
};
const Context = createContext<Personalisation>({
  profile: emptyInterests,
  ready: false,
  error: false,
  record: () => {},
  refresh: () => {},
  resetBehavior: async () => false,
});
export const usePersonalisation = () => useContext(Context);
type LocalActivity = {
  installation: string;
  rows: ActivityAggregate[];
  viewed: Record<string, number>;
  pending: string[];
  since: number;
};
function localActivity(key: string, userID: string): LocalActivity {
  const parsed = JSON.parse(
    localStorage.getItem(key) || "null",
  ) as LocalActivity | null;
  if (!parsed || !isUUID(parsed.installation))
    return {
      installation: crypto.randomUUID(),
      rows: [],
      viewed: {},
      pending: [],
      since: 0,
    };
  const oldest = activityDay(Date.now() - 112 * 86400000);
  return {
    ...parsed,
    pending: Array.isArray(parsed.pending)
      ? parsed.pending.filter((k) => typeof k === "string")
      : [],
    since: Number.isFinite(parsed.since) ? parsed.since : 0,
    viewed: Object.fromEntries(
      Object.entries(parsed.viewed || {}).filter(
        ([id, at]) =>
          isUUID(id) && Number.isFinite(at) && Date.now() - at < 1800000,
      ),
    ),
    rows: (Array.isArray(parsed.rows) ? parsed.rows : []).filter(
      (row) =>
        row.user_id === userID &&
        row.installation_id === parsed.installation &&
        row.activity_day >= oldest &&
        row.activity_day <= activityDay(Date.now()) &&
        Number.isInteger(row.activity_count) &&
        row.activity_count > 0 &&
        row.activity_count <= 1000 &&
        validActivity({
          kind: row.kind as ActivityEvent["kind"],
          securityID: row.security_id || undefined,
          relatedID: row.related_security_id || undefined,
          variant: row.variant,
        }),
    ),
  };
}
export function PersonalisationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, user } = useAccount();
  return user && client ? (
    <Session key={user.id} client={client} userID={user.id}>
      {children}
    </Session>
  ) : (
    <Context.Provider
      value={{
        profile: emptyInterests,
        ready: false,
        error: false,
        record: () => {},
        refresh: () => {},
        resetBehavior: async () => false,
      }}
    >
      {children}
    </Context.Provider>
  );
}
function Session({
  children,
  client,
  userID,
}: {
  children: React.ReactNode;
  client: SupabaseClient;
  userID: string;
}) {
  const { privateMode } = useAccount();
  const now = useClock();
  const key = `investao.personalisation.v1.${userID}`;
  const [since, setSince] = useState(0);
  const [syncError, setSyncError] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const rows: ActivityAggregate[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("user_activity_daily")
        .select(
          "user_id,installation_id,activity_day,kind,security_id,related_security_id,variant,activity_count",
        )
        .eq("user_id", userID)
        .gte("activity_day", activityDay(Date.now() - 112 * 86400000))
        .order("activity_day", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    const [watches, transactions] = await Promise.all([
      watchlist(client, userID),
      ledger(client),
    ]);
    const alerts: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("notification_rules")
        .select("security_id,id")
        .eq("user_id", userID)
        .eq("is_enabled", true)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      alerts.push(...data.map((row) => row.security_id));
      if (data.length < 500) break;
    }
    return {
      rows,
      watched: watches.map((row) => row.security_id),
      held: positions(transactions)
        .filter((p) => p.quantity.gt(0))
        .map((p) => p.securityID),
      alerts,
    };
  }, [client, userID]);
  const state = useResource(load);
  const { reload } = state;
  const sync = useCallback(
    async (event?: ActivityEvent) => {
      const signal = abort.current?.signal;
      // Web Locks serialize cumulative counters across tabs and retries.
      if (
        privateMode ||
        !signal ||
        signal.aborted ||
        !navigator.locks ||
        (event && !validActivity(event))
      )
        return;
      try {
        await navigator.locks.request(key, { signal }, async () => {
          if (signal.aborted) return;
          const { data } = await client.auth.getSession();
          if (data.session?.user.id !== userID || signal.aborted) return;
          const saved = localActivity(key, userID);
          const now = Date.now();
          if (
            event &&
            !(
              event.kind === "asset_view" &&
              now - (saved.viewed[event.securityID!] || 0) < 1800000
            )
          ) {
            if (event.kind === "asset_view")
              saved.viewed[event.securityID!] = now;
            const row: ActivityAggregate = {
              user_id: userID,
              installation_id: saved.installation,
              activity_day: activityDay(now),
              kind: event.kind,
              security_id: event.securityID || null,
              related_security_id: event.relatedID || null,
              variant: event.variant || "",
              activity_count: 1,
            };
            const old = saved.rows.find(
              (r) => aggregateKey(r) === aggregateKey(row),
            );
            if (old)
              old.activity_count = Math.min(1000, old.activity_count + 1);
            else saved.rows.push(row);
            saved.pending = [...new Set([...saved.pending, aggregateKey(row)])];
          }
          localStorage.setItem(key, JSON.stringify(saved));
          const pending = saved.rows.filter((row) =>
            saved.pending.includes(aggregateKey(row)),
          );
          for (let offset = 0; offset < pending.length; offset += 100) {
            if (signal.aborted) return;
            const { error } = await client
              .from("user_activity_daily")
              .upsert(pending.slice(offset, offset + 100), {
                onConflict:
                  "user_id,installation_id,activity_day,kind,security_id,related_security_id,variant",
              })
              .abortSignal(signal);
            if (error) throw error;
          }
          if (!signal.aborted) {
            saved.pending = [];
            localStorage.setItem(key, JSON.stringify(saved));
            setSince(saved.since);
            setSyncError(false);
          }
        });
      } catch {
        if (!signal.aborted) setSyncError(true);
      }
    },
    [client, key, privateMode, userID],
  );
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      try {
        setSince(localActivity(key, userID).since);
      } catch {
        /* Unavailable local storage leaves personalisation optional. */
      }
      void sync();
    });
    const refresh = () => {
      if (!document.hidden) {
        void sync();
        void reload();
      }
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key, userID, sync, reload]);
  const record = useCallback(
    (event: ActivityEvent) => {
      void Promise.resolve().then(() => sync(event));
    },
    [sync],
  );
  async function resetBehavior() {
    if (!navigator.locks) return false;
    try {
      return await navigator.locks.request(key, async () => {
        if (abort.current?.signal.aborted) return false;
        const saved = localActivity(key, userID);
        saved.since =
          Date.parse(`${activityDay(Date.now())}T00:00:00+01:00`) + 86400000;
        localStorage.setItem(key, JSON.stringify(saved));
        setSince(saved.since);
        return true;
      });
    } catch {
      return false;
    }
  }
  const profile =
    privateMode || !state.data
      ? emptyInterests
      : {
          held: state.data.held,
          watched: state.data.watched,
          alerts: state.data.alerts,
          behavior: behavioralInterest(state.data.rows, userID, now, since),
        };
  return (
    <Context.Provider
      value={{
        profile,
        ready: !state.loading && !!state.data,
        error: !!state.error || syncError,
        record,
        refresh: state.reload,
        resetBehavior,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function RecordAssetView({ securityID }: { securityID: string }) {
  const { record } = usePersonalisation();
  useEffect(() => {
    record({ kind: "asset_view", securityID });
  }, [record, securityID]);
  return null;
}
