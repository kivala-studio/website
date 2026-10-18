"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import {
  useResource,
  ResourceState,
  Feedback,
} from "../components/async-state";
import { date, number } from "../../lib/market-presentation";
type Composition = { title?: string; body?: string };
type Item = {
  id: string;
  category: string;
  title: string;
  body: string;
  preview?: Composition | null;
  created_at: string;
  read: boolean;
  href: string | null;
  source: "account" | "legacy" | "recap";
  unavailable: boolean;
};
type AccountRow = {
  id: string;
  category: string;
  composition: Composition | null;
  preview_composition: Composition | null;
  content_state: string;
  security_id: string | null;
  article_id: string | null;
  read_at: string | null;
  created_at: string;
  recap_receipt_id?: string | null;
};
export default function Activity() {
  const { client, user, privateMode } = useAccount();
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 28 * 86400000).toISOString();
    const account: AccountRow[] = [];
    for (let page = 0; page < 4; page++) {
      const last = account.at(-1);
      const { data, error } = await client!.rpc("get_account_notifications", {
        page_size: 50,
        before_created_at: last?.created_at ?? null,
        before_id: last?.id ?? null,
      });
      if (error) {
        if (error.code === "PGRST202") break;
        throw error;
      }
      account.push(...data);
      if (data.length < 50) break;
    }
    const [legacy, recaps] = await Promise.all([
      client!
        .from("notification_deliveries")
        .select(
          "id,created_at,is_read,delivery_kind,current_price,event_change_percent,account_notification_id,securities(id,symbol),alert_snapshot",
        )
        .eq("user_id", user!.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      client!
        .from("market_recap_receipts")
        .select("id,created_at,is_read,market_recaps(article_id)")
        .eq("user_id", user!.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (legacy.error) throw legacy.error;
    if (recaps.error) throw recaps.error;
    const articleIDs = [
      ...new Set(
        [
          ...account.map((row) => row.article_id),
          ...recaps.data.map(
            (row) =>
              (row.market_recaps as unknown as { article_id: string })
                ?.article_id,
          ),
        ].filter(Boolean),
      ),
    ];
    const articles = articleIDs.length
      ? await client!
          .from("news_articles")
          .select("id,slug,title,summary")
          .in("id", articleIDs)
          .eq("status", "published")
          .lte("published_at", new Date().toISOString())
      : { data: [], error: null };
    if (articles.error) throw articles.error;
    const articleMap = new Map(articles.data!.map((a) => [a.id, a]));
    const accountIDs = new Set(account.map((row) => row.id));
    const receiptIDs = new Set(account.map((row) => row.recap_receipt_id));
    const items: Item[] = account.map((row) => {
      const composition =
        row.category === "portfolio_daily"
          ? row.preview_composition
          : row.composition;
      const article = row.article_id ? articleMap.get(row.article_id) : null;
      const unavailable =
        row.content_state !== "active" || (!!row.article_id && !article);
      return {
        id: row.id,
        category: row.category,
        preview: unavailable ? null : row.preview_composition,
        title: unavailable
          ? "Conteúdo indisponível"
          : composition?.title || "Actualização do mercado",
        body: unavailable
          ? "A informação de origem foi retirada ou deixou de estar disponível."
          : composition?.body || "Consulta os detalhes na fonte.",
        created_at: row.created_at,
        read: !!row.read_at,
        source: "account",
        unavailable,
        href: unavailable
          ? null
          : row.category === "weekly_wrap"
            ? "/resumos"
            : article
              ? `/noticias/${article.slug}`
              : row.security_id
                ? `/mercado/${row.security_id}`
                : row.category === "portfolio_daily"
                  ? `/actividade/${row.id}`
                  : null,
      };
    });
    for (const row of legacy.data) {
      if (
        row.account_notification_id &&
        accountIDs.has(row.account_notification_id)
      )
        continue;
      const s = row.securities as unknown as {
        id: string;
        symbol: string;
      } | null;
      const movement = Number(row.event_change_percent);
      items.push({
        id: row.id,
        source: "legacy",
        category: "alerts",
        title: s?.symbol ? `Actualização de ${s.symbol}` : "Alerta do mercado",
        body:
          row.event_change_percent !== null && Number.isFinite(movement)
            ? `Movimento registado: ${number(movement)}%.`
            : "Foi registado um acontecimento para este instrumento. Consulta a referência actual e a data do alerta.",
        created_at: row.created_at,
        read: row.is_read,
        href: s?.id ? `/mercado/${s.id}` : null,
        unavailable: false,
      });
    }
    for (const row of recaps.data) {
      if (receiptIDs.has(row.id)) continue;
      const ref = row.market_recaps as unknown as { article_id: string };
      const article = articleMap.get(ref?.article_id);
      if (article)
        items.push({
          id: row.id,
          source: "recap",
          category: "market_recap",
          title: article.title,
          body: article.summary,
          created_at: row.created_at,
          read: row.is_read,
          href: `/noticias/${article.slug}`,
          unavailable: false,
        });
    }
    return items
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 200);
  }, [client, user]);
  const state = useResource(load);
  async function mark(items: Item[]) {
    setBusy(true);
    setError("");
    try {
      const account = items
        .filter((i) => i.source === "account")
        .map((i) => i.id);
      for (let i = 0; i < account.length; i += 100) {
        const { error } = await client!.rpc(
          "acknowledge_account_notifications",
          { notification_ids: account.slice(i, i + 100), opened: false },
        );
        if (error) throw error;
      }
      for (const source of ["legacy", "recap"] as const) {
        const ids = items.filter((i) => i.source === source).map((i) => i.id);
        if (ids.length) {
          const { error } = await client!
            .from(
              source === "legacy"
                ? "notification_deliveries"
                : "market_recap_receipts",
            )
            .update({ is_read: true })
            .eq("user_id", user!.id)
            .in("id", ids);
          if (error) throw error;
        }
      }
      await state.reload();
    } catch {
      setError("Não foi possível marcar a actividade como lida.");
    } finally {
      setBusy(false);
    }
  }
  const shown = state.data?.filter(
    (item) =>
      filter === "all" ||
      (filter === "unread" && !item.read) ||
      item.category === filter,
  );
  return (
    <>
      <div className="section-title">
        <div className="filter-tabs">
          {[
            ["all", "Tudo"],
            ["unread", "Por ler"],
            ["alerts", "Alertas"],
            ["asset_movement", "Movimentos"],
            ["market_recap", "Resumos"],
            ["portfolio_daily", "Carteira"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          disabled={busy || !state.data?.some((i) => !i.read)}
          onClick={() => mark(state.data!.filter((i) => !i.read))}
        >
          Marcar todas como lidas
        </button>
      </div>
      <ResourceState {...state} retry={state.reload} />
      <Feedback error={error} />
      {shown?.length === 0 && (
        <div className="empty-state">
          <h2>Está tudo em dia.</h2>
          <p>Os próximos acontecimentos da tua conta aparecem aqui.</p>
        </div>
      )}
      {shown?.map((item) => (
        <article className="activity-row" key={`${item.source}-${item.id}`}>
          <span
            className={`activity-dot ${item.read ? "read" : ""}`}
            aria-label={item.read ? "Lida" : "Por ler"}
          />
          <div>
            <small>{date(item.created_at, true)} · Luanda</small>
            <h3>
              {privateMode && item.source === "account" && !item.unavailable
                ? item.preview?.title || "Actualização do mercado"
                : item.title}
            </h3>
            <p>
              {privateMode && item.source === "account" && !item.unavailable
                ? item.preview?.body ||
                  "Abre o conteúdo para consultar os detalhes."
                : item.body}
            </p>
            <div className="row-actions">
              {item.href && <Link href={item.href}>Ver detalhes</Link>}
              {!item.read && (
                <button disabled={busy} onClick={() => mark([item])}>
                  Marcar como lida
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
      <button
        className="secondary-button"
        onClick={state.reload}
        disabled={state.loading}
      >
        Actualizar actividade
      </button>
    </>
  );
}
