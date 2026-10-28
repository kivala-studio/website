"use client";
import { useState } from "react";
import Link from "next/link";
import type { Market } from "../../lib/public-data";
import { kind, reading } from "../../lib/market-presentation";
import HistoryChart from "./history-chart";
import MarketReading from "../market-reading";
import Icon from "./invest-icon";
export default function MarketSpotlight({ market }: { market: Market }) {
  const equities = market.securities.filter((s) => kind(s) === "Acções");
  const [selected, setSelected] = useState(equities[0]?.id || "");
  const security = equities.find((s) => s.id === selected);
  if (!security) return null;
  return (
    <section className="market-spotlight">
      <div className="spotlight-tabs" aria-label="Seleccionar acção">
        {equities.map((s) => (
          <button
            key={s.id}
            aria-pressed={selected === s.id}
            onClick={() => setSelected(s.id)}
          >
            {s.issuers?.short_name || s.symbol}
          </button>
        ))}
      </div>
      <div className="spotlight-header">
        <div>
          <h2>
            {security.issuers?.short_name ||
              security.issuers?.name ||
              security.name ||
              security.symbol}
          </h2>
          <p className="spotlight-symbol">{security.symbol}</p>
          <Link className="spotlight-detail" href={`/mercado/${security.id}`}>
            Ver instrumento <Icon name="chevron-right" size={15} />
          </Link>
        </div>
        <MarketReading
          large
          context={false}
          security={security}
          value={reading(security, market)}
        />
      </div>
      <HistoryChart key={security.id} security={security} />
    </section>
  );
}
