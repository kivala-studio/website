import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publicationInsights,
  type InsightArticle,
} from "./publication-insights";
import { positions } from "./finance";
import { ledger, watchlist } from "./account-data";
import type { Security } from "./public-data";
import { parseControls } from "./intelligence-controls";
import { verifiedInsights } from "./verified-insights";
import type { WrapWindow } from "./wrap-evidence";
export async function loadInsights(client: SupabaseClient, userID: string) {
  const now = Date.now(),
    today = new Date(now + 3600000).toISOString().slice(0, 10),
    weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = Date.parse(today) - weekday * 86400000,
    day = (offset: number) =>
      new Date(monday + offset * 86400000).toISOString().slice(0, 10);
  const catalogue = async () => {
    const values: Security[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("securities")
        .select(
          "id,symbol,name,isin,currency,security_type,issuer_id,is_active,issuers(name,short_name,sector)",
        )
        .eq("is_active", true)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      values.push(...(data as unknown as Security[]));
      if (data.length < 500) return values;
    }
  };
  const [calendar, controls, transactions, watches, securities, articles] =
    await Promise.all([
      client.rpc("get_market_calendar", { starts_on: day(0), ends_on: day(6) }),
      client
        .from("intelligence_feature_configuration")
        .select("payload")
        .eq("id", true)
        .single(),
      ledger(client).catch(() => null),
      watchlist(client, userID),
      catalogue(),
      client
        .from("news_articles")
        .select(
          "id,slug,title,summary,published_at,news_article_securities(securities(id,symbol,name)),news_article_sources(is_primary,source_url,source_title,news_sources(name))",
        )
        .eq("status", "published")
        .lte("published_at", new Date(now).toISOString())
        .gte("published_at", new Date(now - 7 * 86400000).toISOString())
        .order("published_at", { ascending: false })
        .order("id")
        .limit(100)
        .then((result) =>
          result.error ? null : (result.data as unknown as InsightArticle[]),
        ),
    ]);
  if (controls.error) throw new Error("Insight context unavailable");
  let period: WrapWindow = {
    period_type: "weekly",
    starts_on: day(-7),
    ends_on: day(-1),
    available_at: new Date(0).toISOString(),
    expires_at: new Date(now + 900000).toISOString(),
  };
  let financial: ReturnType<typeof verifiedInsights> = [],
    financialUnavailable = false;
  try {
    if (calendar.error) throw calendar.error;
    const c = calendar.data;
    if (
      c?.contract_version !== 2 ||
      c.timezone !== "Africa/Luanda" ||
      !/^https:\/\//.test(c.source) ||
      !(Date.parse(c.valid_until) > now) ||
      !(Date.parse(c.fetched_at) <= now) ||
      !Array.isArray(c.days) ||
      c.days.length !== 7
    )
      throw new Error("Unverified calendar");
    for (let i = 0; i < 7; i++)
      if (
        c.days[i].day !== day(i) ||
        c.days[i].kind === "unknown" ||
        (c.days[i].opens_at && !c.days[i].closes_at)
      )
        throw new Error("Incomplete calendar");
    const open = c.days.filter((d: { opens_at: string | null }) => d.opens_at);
    const future = open.some(
      (d: { day: string; closes_at: string }) =>
        Date.parse(`${d.day}T${d.closes_at}+01:00`) > now,
    );
    const start = future || !open.length ? -7 : 0;
    period = {
      period_type: "weekly",
      starts_on: day(start),
      ends_on: day(start + 6),
      available_at: new Date(0).toISOString(),
      expires_at: new Date(now + 900000).toISOString(),
    };
    const result = await client.rpc("get_market_period_evidence", {
      starts_on: period.starts_on,
      ends_on: period.ends_on,
      requested_kind: "weekly",
    });
    if (result.error) throw result.error;
    financial = verifiedInsights({
      evidence: result.data,
      period,
      securities,
      transactions: transactions || [],
      watchedIDs: watches.map((w) => w.security_id),
      now: Date.now(),
      metadataFetchedAt: now,
      ledgerFetchedAt: transactions ? now : NaN,
    });
  } catch {
    financialUnavailable = true;
  }
  const { data } = await client.auth.getSession();
  if (data.session?.user.id !== userID) throw new Error("Account changed");
  const fetched = Date.now();
  let held: string[] = [];
  try {
    held = positions(transactions || [])
      .filter((p) => p.quantity.gt(0))
      .map((p) => p.securityID);
  } catch {}
  return {
    insights: [
      ...financial,
      ...(await publicationInsights(
        articles || [],
        watches.map((w) => w.security_id),
        period,
        now,
        fetched,
      )),
    ],
    controls: parseControls(controls.data.payload),
    period,
    fetchedAt: fetched,
    portfolioAvailable: transactions !== null,
    financialUnavailable,
    publicationsUnavailable: articles === null,
    held,
    watched: watches.map((w) => w.security_id),
  };
}
