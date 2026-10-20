"use client";
import { useEffect, useState } from "react";
import {
  date,
  number,
  priceText,
  type Reading,
} from "../lib/market-presentation";
import type { Security } from "../lib/public-data";
export default function MarketReading({
  security,
  value,
  large = false,
  context = large,
}: {
  security: Security;
  value: Reading;
  large?: boolean;
  context?: boolean;
}) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!value.deadline) return;
    const update = () => setExpired(Date.now() >= value.deadline! * 1000);
    update();
    const timer = setTimeout(
      update,
      Math.max(0, value.deadline * 1000 - Date.now()),
    );
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [value.deadline]);
  const change = expired ? null : value.change;
  return (
    <div className={large ? "price-reading large" : "price-reading"}>
      <strong>{priceText(security, value.price)}</strong>
      <span>
        {expired && value.label === "Cotação BODIVA"
          ? "Última cotação BODIVA"
          : value.label}
        {value.priceDate ? ` · ${date(value.priceDate)}` : ""}
      </span>
      <div
        className={
          change === null || change === 0
            ? "movement"
            : change > 0
              ? "movement positive"
              : "movement negative"
        }
      >
        {change === null
          ? "Variação indisponível"
          : `${change > 0 ? "↑ +" : change < 0 ? "↓ " : "= "}${number(change)}%`}
      </div>
      {context ? (
        <>
          <span>
            {change === null
              ? "Sem referência de variação confirmada."
              : value.changeLabel}
          </span>
          {value.verifiedAt ? (
            <span>Verificação: {date(value.verifiedAt, true)} · Luanda</span>
          ) : null}
          {value.source ? (
            <a
              className="source-link"
              href={value.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar fonte BODIVA ↗
            </a>
          ) : null}
          {value.note ? <span>{value.note}</span> : null}
        </>
      ) : null}
      {(value.stale || expired) && value.price !== null ? (
        <span className="freshness">
          Referência datada · sem garantia de actualidade
        </span>
      ) : null}
    </div>
  );
}
