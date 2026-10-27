import Link from "./components/workspace-link";
import { getMarket, read, type Market, type Quality, type Security } from "../lib/public-data";
import { date, kind, number, priceText, reading, type Reading } from "../lib/market-presentation";

type Row = { security: Security; value: Reading };
type PulseRow = { trading_date: string; value: number; daily_change_percent: number; data_quality: Quality };

// Expired intraday changes are hidden, matching MarketReading on the client.
function rows(market: Market): Row[] {
  const now = Date.now();
  return market.securities
    .filter((security) => kind(security) === "Acções")
    .map((security) => {
      const value = reading(security, market, now);
      return { security, value: value.deadline && now >= value.deadline * 1000 ? { ...value, change: null } : value };
    })
    .filter((row) => row.value.price !== null)
    .sort((a, b) => a.security.symbol.localeCompare(b.security.symbol));
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="change-pill">—</span>;
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "";
  return <span className={`change-pill ${tone}`}>{value > 0 ? "▲ " : value < 0 ? "▼ " : ""}{number(Math.abs(value))}%</span>;
}

function name(security: Security) {
  return security.issuers?.short_name || security.symbol;
}

export async function MarketTicker() {
  const result = await getMarket();
  if (result.error) return null;
  const items = rows(result.data);
  if (!items.length) return null;
  const strip = items.map(({ security, value }) => (
    <Link key={security.id} href={`/mercado/${security.id}`} prefetch={false} className="ticker-item">
      <strong>{name(security)}</strong>
      <span>{priceText(security, value.price)}</span>
      <Change value={value.change} />
    </Link>
  ));
  return (
    <div className="ticker" aria-label="Preços das acções na BODIVA">
      <div className="ticker-track">{strip}</div>
      <div className="ticker-track" aria-hidden="true" inert>{strip}</div>
    </div>
  );
}

export async function PulseCard() {
  const data = await read<PulseRow[]>("quality_market_pulse_history", {
    select: "trading_date,value,daily_change_percent,data_quality",
    order: "trading_date.desc",
    limit: "30",
  }).catch(() => null);
  const valid = (data ?? [])
    .filter((row) => Number.isFinite(row.value) && row.value > 0 && row.data_quality?.status === "valid" && !row.data_quality.reasons.length)
    .sort((a, b) => a.trading_date.localeCompare(b.trading_date));
  const last = valid.at(-1);
  if (!last) return null;
  const values = valid.map((row) => row.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const path = values.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(values.length - 1, 1)) * 200} ${56 - ((value - min) / span) * 52}`).join(" ");
  const change = last.daily_change_percent;
  return (
    <div className="pulse-card">
      <span className="pulse-label">Indicador invest.ao</span>
      <strong>{number(last.value)}</strong>
      <Change value={Number.isFinite(change) ? change : null} />
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg>
      <small>Fechos de {date(last.trading_date)}</small>
    </div>
  );
}

function MoverList({ title, items }: { title: string; items: Row[] }) {
  return (
    <div className="movers-card">
      <h3>{title}</h3>
      <ol>
        {items.map(({ security, value }) => (
          <li key={security.id}>
            <Link href={`/mercado/${security.id}`} prefetch={false} className="mover-row">
              <span className="issuer-mark" aria-hidden="true">{security.symbol.slice(0, 2)}</span>
              <span className="mover-name"><strong>{name(security)}</strong><small>{security.symbol}</small></span>
              <span className="mover-price"><strong>{priceText(security, value.price)}</strong><small>{value.priceDate ? date(value.priceDate) : value.label}</small></span>
              <Change value={value.change} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export async function MarketMovers() {
  const result = await getMarket();
  if (result.error)
    return <p className="market-state" role="status">Não foi possível consultar os preços neste momento.</p>;
  const items = rows(result.data);
  const changed = items.filter((row) => row.value.change !== null && row.value.change !== 0);
  const up = changed.filter((row) => row.value.change! > 0).sort((a, b) => b.value.change! - a.value.change!).slice(0, 4);
  const down = changed.filter((row) => row.value.change! < 0).sort((a, b) => a.value.change! - b.value.change!).slice(0, 4);
  if (!up.length && !down.length) return <div className="movers"><MoverList title="Acções" items={items.slice(0, 6)} /></div>;
  return (
    <div className="movers">
      {up.length > 0 && <MoverList title="Maiores subidas" items={up} />}
      {down.length > 0 && <MoverList title="Maiores descidas" items={down} />}
    </div>
  );
}

export function MarketMoversLoading() {
  return <div className="movers" aria-busy="true"><div className="movers-card skeleton-card" /><div className="movers-card skeleton-card" /></div>;
}

