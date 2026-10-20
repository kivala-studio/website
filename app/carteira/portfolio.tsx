"use client";
import InsightSection from "../components/insight-section";
import PortfolioPerformance from "./performance";
import { useClock } from "../components/use-clock";
import Link from "next/link";
import Decimal from "decimal.js";
import { useCallback, useMemo, useState } from "react";
import { useAccount } from "../components/account-provider";
import {
  Feedback,
  ResourceState,
  useResource,
} from "../components/async-state";
import { ledger, type Transaction } from "../../lib/account-data";
import { positions, todayLuanda } from "../../lib/finance";
import { date, kind, number, usableQuote } from "../../lib/market-presentation";
import type { Market } from "../../lib/public-data";
export default function Portfolio({
  market,
  securityID,
}: {
  market: Market | null;
  securityID?: string;
}) {
  const now = useClock();
  const { client, user, privateMode } = useAccount();
  const load = useCallback(() => ledger(client!), [client]);
  const state = useResource(load);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const calculated = useMemo(() => {
    try {
      return {
        positions: positions(
          (state.data || []).filter(
            (t) => !securityID || t.security_id === securityID,
          ),
        ),
        error: "",
      };
    } catch (e) {
      return {
        positions: [],
        error: e instanceof Error ? e.message : "Registos inválidos.",
      };
    }
  }, [state.data, securityID]);
  const held = calculated.positions
    .filter((p) => p.quantity.gt(0))
    .map((p) => {
      const s = market?.securities.find((s) => s.id === p.securityID);
      const quote = s && market ? usableQuote(s, market, now) : null;
      const eligible =
        s?.currency === "AOA" && ["Acções", "Fundos"].includes(kind(s));
      const price = eligible && quote && !quote.stale ? quote.price : null;
      return {
        ...p,
        security: s,
        value: price === null ? null : p.quantity.times(price),
        quote,
      };
    });
  const missing = held.filter((p) => p.value === null).length;
  const currenciesKnown = held.every((p) => p.security?.currency === "AOA");
  const cost = held.reduce((sum, p) => sum.plus(p.cost), new Decimal(0));
  const value = held.reduce((sum, p) => sum.plus(p.value || 0), new Decimal(0));
  const money = (value: Decimal | number) =>
    privateMode ? "••••••" : `${number(Number(value))} Kz`;
  async function remove(row: Transaction) {
    if (!window.confirm("Eliminar esta operação? A carteira será recalculada."))
      return;
    setBusy(true);
    setError("");
    try {
      positions(state.data!.filter((item) => item.id !== row.id));
      const { error } = await client!
        .from("portfolio_transactions")
        .delete()
        .eq("user_id", user!.id)
        .eq("id", row.id);
      if (error) throw error;
      await state.reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível eliminar a operação.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-title">
        <Link href="/simular" className="text-button">
          Experimentar uma simulação
        </Link>
        <button
          className="primary-button"
          disabled={state.loading || !!state.error}
          onClick={() => {
            setEditing(null);
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Fechar formulário" : "+ Registar operação"}
        </button>
      </div>
      <ResourceState {...state} retry={state.reload} />
      <Feedback error={error || calculated.error} />
      {showForm && (
        <TransactionForm
          key={editing?.id || "new"}
          market={market}
          transactions={state.data || []}
          editing={editing}
          defaultSecurity={securityID}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await state.reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {state.data && !calculated.error && (
        <>
          {!securityID && (
            <InsightSection
              surface="portfolio"
              revision={JSON.stringify(state.data)}
            />
          )}
          <div className="metric-grid">
            <div>
              <span>Custo das posições abertas</span>
              <strong>{currenciesKnown ? money(cost) : "Indisponível"}</strong>
              <small>Custo médio ponderado</small>
            </div>
            <div>
              <span>Valor de referência</span>
              <strong>
                {missing || !currenciesKnown ? "Indisponível" : money(value)}
              </strong>
              <small>
                {missing
                  ? `${missing} posição(ões) sem cotação elegível`
                  : "Cotações disponíveis · não inclui taxas"}
              </small>
            </div>
            <div>
              <span>Resultado não realizado</span>
              <strong className={value.gte(cost) ? "positive" : "negative"}>
                {missing || !currenciesKnown
                  ? "Indisponível"
                  : money(value.minus(cost))}
              </strong>
              <small>Diferença face ao custo das posições</small>
            </div>
          </div>
          {state.data.length > 0 && (
            <PortfolioPerformance
              transactions={
                securityID
                  ? state.data.filter((t) => t.security_id === securityID)
                  : state.data
              }
            />
          )}
          <div className="metric-grid">
            <div>
              <span>Resultado realizado</span>
              <strong>
                {money(
                  calculated.positions.reduce(
                    (sum, p) => sum.plus(p.realized),
                    new Decimal(0),
                  ),
                )}
              </strong>
              <small>Vendas menos custo médio · sem encargos</small>
            </div>
            <div>
              <span>Operações registadas</span>
              <strong>
                {
                  state.data.filter(
                    (t) => !securityID || t.security_id === securityID,
                  ).length
                }
              </strong>
            </div>
          </div>
          {!held.length && (
            <div className="empty-state">
              <h2>A tua carteira começa com um registo.</h2>
              <p>
                Adiciona uma compra para acompanhar o investimento. Os registos
                não executam ordens no mercado.
              </p>
            </div>
          )}
          <section className="dashboard-panel">
            <div className="section-title">
              <h2>Posições e distribuição</h2>
              <span className="fine-print">{held.length} posições</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Instrumento</th>
                    <th>Quantidade</th>
                    <th>Custo médio</th>
                    <th>Valor de referência</th>
                    <th>Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {held.map((p) => (
                    <tr key={p.securityID}>
                      <td>
                        <Link href={`/carteira/${p.securityID}`}>
                          <strong>
                            {p.security?.symbol || "Instrumento indisponível"}
                          </strong>
                          <small>{p.security?.name}</small>
                        </Link>
                      </td>
                      <td>
                        {privateMode
                          ? "••••"
                          : p.quantity.toDecimalPlaces(8).toString()}
                      </td>
                      <td>
                        {p.security?.currency === "AOA"
                          ? money(p.average)
                          : "Indisponível"}
                      </td>
                      <td>
                        {p.value === null ? "Indisponível" : money(p.value)}
                        <small>
                          {p.quote?.priceDate
                            ? date(p.quote.priceDate)
                            : "Sem referência elegível"}
                        </small>
                      </td>
                      <td>
                        {!missing && value.gt(0) ? (
                          <>
                            {privateMode
                              ? "••"
                              : `${number(p.value!.div(value).times(100).toNumber())}%`}
                            <div className="allocation-bar" aria-hidden="true">
                              <span
                                style={{
                                  width: privateMode
                                    ? "0%"
                                    : `${p.value!.div(value).times(100).toNumber()}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="public-section">
            <h2>Histórico de operações</h2>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Instrumento</th>
                    <th>Operação</th>
                    <th>Quantidade</th>
                    <th>Preço unitário</th>
                    <th>Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data
                    .filter((t) => !securityID || t.security_id === securityID)
                    .toReversed()
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{date(row.traded_on)}</td>
                        <td>
                          {market?.securities.find(
                            (s) => s.id === row.security_id,
                          )?.symbol || "Instrumento"}
                        </td>
                        <td>
                          {row.transaction_kind === "buy" ? "Compra" : "Venda"}
                        </td>
                        <td>
                          {privateMode ? "••••" : number(Number(row.quantity))}
                        </td>
                        <td>{money(Number(row.unit_price))}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEditing(row);
                                setShowForm(true);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Editar
                            </button>
                            <button disabled={busy} onClick={() => remove(row)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
function TransactionForm({
  market,
  transactions,
  editing,
  defaultSecurity,
  onSaved,
  onCancel,
}: {
  market: Market | null;
  transactions: Transaction[];
  editing: Transaction | null;
  defaultSecurity?: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { client, user } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible =
    market?.securities.filter(
      (s) => s.currency === "AOA" && ["Acções", "Fundos"].includes(kind(s)),
    ) || [];
  return (
    <form
      className="form-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const row: Transaction = {
            id: editing?.id || crypto.randomUUID(),
            security_id: String(form.get("security")),
            transaction_kind: String(form.get("kind")) as "buy" | "sell",
            quantity: String(form.get("quantity")),
            unit_price: String(form.get("price")),
            traded_on: String(form.get("day")),
            created_at: editing?.created_at || new Date().toISOString(),
          };
          if (
            ![row.quantity, row.unit_price].every(
              (v) =>
                /^\d+(\.\d{1,8})?$/.test(String(v)) && new Decimal(v).lte(1e12),
            )
          )
            throw new Error(
              "Usa valores positivos com até 8 casas decimais e até 1 bilião.",
            );
          if (!eligible.some((s) => s.id === row.security_id) && !editing)
            throw new Error("Selecciona uma acção ou fundo em AOA.");
          if (
            eligible.some(
              (s) => s.id === row.security_id && kind(s) === "Acções",
            ) &&
            !new Decimal(row.quantity).isInteger()
          )
            throw new Error("As acções exigem uma quantidade inteira.");
          positions([...transactions.filter((t) => t.id !== row.id), row]);
          const values = {
            transaction_kind: row.transaction_kind,
            quantity: row.quantity,
            unit_price: row.unit_price,
            traded_on: row.traded_on,
          };
          const { error } = editing
            ? await client!
                .from("portfolio_transactions")
                .update(values)
                .eq("user_id", user!.id)
                .eq("id", editing.id)
            : await client!.from("portfolio_transactions").insert({
                ...values,
                id: row.id,
                security_id: row.security_id,
                user_id: user!.id,
              });
          if (error)
            throw new Error(
              "Não foi possível guardar. A carteira pode ter mudado; actualiza e tenta novamente.",
            );
          await onSaved();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Não foi possível guardar.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{editing ? "Editar operação" : "Registar operação"}</h2>
      <div className="form-grid">
        <label>
          Instrumento
          <select
            name="security"
            required
            defaultValue={editing?.security_id || defaultSecurity || ""}
            disabled={!!editing}
          >
            <option value="">Seleccionar</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.symbol} · {s.issuers?.name || s.name}
              </option>
            ))}
          </select>
          {editing && (
            <input type="hidden" name="security" value={editing.security_id} />
          )}
        </label>
        <label>
          Operação
          <select name="kind" defaultValue={editing?.transaction_kind || "buy"}>
            <option value="buy">Compra</option>
            <option value="sell">Venda</option>
          </select>
        </label>
        <label>
          Quantidade
          <input
            name="quantity"
            type="number"
            min="0.00000001"
            max="1000000000000"
            step="0.00000001"
            required
            defaultValue={editing?.quantity}
          />
        </label>
        <label>
          Preço unitário (Kz)
          <input
            name="price"
            type="number"
            min="0.00000001"
            max="1000000000000"
            step="0.00000001"
            required
            defaultValue={editing?.unit_price}
          />
        </label>
        <label>
          Data da operação
          <input
            name="day"
            type="date"
            required
            max={todayLuanda()}
            defaultValue={editing?.traded_on || todayLuanda()}
          />
        </label>
      </div>
      <Feedback error={error} />
      <div className="instrument-actions">
        <button className="primary-button" disabled={busy}>
          {busy ? "A guardar…" : "Guardar operação"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p>
        Disponível para acções e fundos em AOA. Não são incluídas comissões,
        impostos ou dividendos.
      </p>
    </form>
  );
}
