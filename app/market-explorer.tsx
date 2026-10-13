"use client";
import Link from "next/link";
import { useState } from "react";
import { kind, type Reading } from "../lib/market-presentation";
import type { Security } from "../lib/public-data";
import MarketReading from "./market-reading";
export type MarketRow = { security: Security; value: Reading };
export default function MarketExplorer({
  rows,
  search = false,
}: {
  rows: MarketRow[];
  search?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalized = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const shown = rows.filter(({ security: s }) =>
    normalized(`${s.symbol} ${s.name ?? ""} ${s.issuers?.name ?? ""}`).includes(
      normalized(query.trim()),
    ),
  );
  return (
    <>
      {search ? (
        <div className="search-field">
          <label htmlFor="instrument-search">Procurar instrumento</label>
          <input
            id="instrument-search"
            type="search"
            placeholder="Nome ou símbolo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p role="status">
            {shown.length} {shown.length === 1 ? "instrumento" : "instrumentos"}
          </p>
        </div>
      ) : null}
      <div className="market-list">
        <div className="market-labels" aria-hidden="true">
          <span>Instrumento / tipo</span>
          <span>Cotação / variação</span>
        </div>
        {shown.map(({ security: s, value }) => (
          <Link
            prefetch={false}
            href={`/mercado/${s.id}`}
            className="market-row"
            key={s.id}
          >
            <div className="instrument-identity">
              <strong>{s.symbol}</strong>
              <span>
                {s.issuers?.name || (s.name !== s.symbol ? s.name : null)}
              </span>
              <small>{kind(s)}</small>
            </div>
            <MarketReading security={s} value={value} />
          </Link>
        ))}
        {!shown.length ? (
          <div className="data-state" role="status">
            <h3>
              {query
                ? "Nenhum instrumento encontrado."
                : "Não há instrumentos disponíveis."}
            </h3>
            <p>
              {query
                ? "Tenta outro nome ou símbolo."
                : "Volta a consultar mais tarde."}
            </p>
            {query ? (
              <button className="quiet-button" onClick={() => setQuery("")}>
                Limpar pesquisa
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
