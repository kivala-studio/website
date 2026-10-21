"use client";
import { usePersonalisation } from "./components/personalisation-provider";
import { interestWeight } from "../lib/personalisation";
import Link from "next/link";
import { useState } from "react";
import { kind, type Reading } from "../lib/market-presentation";
import type { Security } from "../lib/public-data";
import MarketReading from "./market-reading";
export type MarketRow = { security: Security; value: Reading };
export default function MarketExplorer({
  rows,
  search = false,
  searchResults = false,
}: {
  rows: MarketRow[];
  search?: boolean;
  searchResults?: boolean;
}) {
  const { profile, record, ready } = usePersonalisation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("symbol");
  const normalized = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const shown = rows
    .filter(
      ({ security: s }) =>
        (category === "Todos" || kind(s) === category) &&
        normalized(
          `${s.symbol} ${s.name ?? ""} ${s.issuers?.name ?? ""}`,
        ).includes(normalized(query.trim())),
    )
    .sort((a, b) =>
      sort === "personal"
        ? interestWeight(profile, [b.security.id]) -
            interestWeight(profile, [a.security.id]) ||
          a.security.symbol.localeCompare(b.security.symbol)
        : sort === "change"
          ? (b.value.change ?? -Infinity) - (a.value.change ?? -Infinity)
          : a.security.symbol.localeCompare(b.security.symbol),
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
      {search && (
        <>
          <div className="filter-tabs">
            {[
              "Todos",
              "Acções",
              "Fundos",
              "Obrigações",
              "Obrigações do Tesouro",
            ].map((label) => (
              <button
                key={label}
                aria-pressed={category === label}
                onClick={() => setCategory(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sort-control">
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {ready && (
                <option value="personal">Relação com a tua conta</option>
              )}
              <option value="symbol">Símbolo</option>
              <option value="change">Variação disponível</option>
            </select>
          </label>
        </>
      )}
      <div className="market-list">
        <div className="market-labels" aria-hidden="true">
          <span>Instrumento / tipo</span>
          <span>Cotação / variação</span>
        </div>
        {shown.map(({ security: s, value }) => (
          <Link
            prefetch={false}
            href={`/mercado/${s.id}`}
            onClick={() => {
              if (searchResults || query.trim())
                record({ kind: "search_select", securityID: s.id });
            }}
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
              {query || searchResults
                ? "Nenhum instrumento encontrado."
                : "Não há instrumentos disponíveis."}
            </h3>
            <p>
              {query || searchResults
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
