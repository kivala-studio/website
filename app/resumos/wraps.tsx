"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "../components/account-provider";
import { usePersonalisation } from "../components/personalisation-provider";
import {
  ResourceState,
  useResource,
  Feedback,
} from "../components/async-state";
import { ledger, watchlist } from "../../lib/account-data";
import { date, number, priceText } from "../../lib/market-presentation";
import type { Market } from "../../lib/public-data";
import type { WrapWindow, WrapEvidence } from "../../lib/wrap-evidence";
import {
  archiveExpired,
  periodKey,
  saveEdition,
  repairEdition,
  recordPlayback,
  type WrapArchive,
  type WrapEdition,
  type WrapEvent,
} from "../../lib/wrap-archive";
import { listArchives, mutateArchive } from "../../lib/wrap-storage";
import {
  createEdition,
  hydrateEdition,
  personalizationEdition,
} from "./edition";
import { useClock } from "../components/use-clock";
import WrapStories from "./stories";
export type { WrapWindow as Window } from "../../lib/wrap-evidence";

export default function Wraps({
  windows,
  market,
}: {
  windows: WrapWindow[];
  market: Market | null;
}) {
  const { user } = useAccount();
  const params = useSearchParams();
  const [choice, setChoice] = useState("");
  const load = useCallback(async () => {
    try {
      return { records: await listArchives(user!.id), storage: true };
    } catch (error) {
      if (
        error instanceof DOMException &&
        ["QuotaExceededError", "SecurityError", "InvalidStateError"].includes(
          error.name,
        )
      )
        return { records: [] as WrapArchive[], storage: false };
      throw error;
    }
  }, [user]);
  const history = useResource(load);
  const options = new Map(windows.map((w) => [periodKey(w), w]));
  for (const saved of history.data?.records || [])
    options.set(saved.key, saved.editions[0].period);
  const requested = params.get("period") || "";
  const key = options.has(choice)
    ? choice
    : options.has(requested)
      ? requested
      : options.keys().next().value;
  const selected = key ? options.get(key) : null;
  return (
    <>
      <p className="fine-print">
        As edições ficam guardadas neste navegador, separadas por conta. O
        histórico da app permanece no dispositivo onde foi criado.
      </p>
      <ResourceState
        loading={history.loading}
        error={
          history.error
            ? "Não foi possível ler o histórico deste navegador. As edições guardadas não foram substituídas."
            : ""
        }
        retry={history.reload}
      />
      {!!history.data &&
        !history.error &&
        (selected ? (
          <>
            <label className="period-picker">
              Período
              <select value={key} onChange={(e) => setChoice(e.target.value)}>
                {[...options]
                  .sort(([, a], [, b]) =>
                    b.starts_on.localeCompare(a.starts_on),
                  )
                  .map(([id, w]) => (
                    <option key={id} value={id}>
                      {w.period_type === "weekly" ? "Semana" : "Mês"} ·{" "}
                      {date(w.starts_on)} a {date(w.ends_on)}
                      {history.data?.records.some((a) => a.key === id)
                        ? " · Guardado"
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            <WrapDetail
              key={key}
              selected={selected}
              market={market}
              saved={history.data?.records.find((a) => a.key === key) || null}
              onSaved={history.reload}
            />
          </>
        ) : (
          <p className="empty-state">
            Ainda não há períodos disponíveis nem edições guardadas neste
            navegador.
          </p>
        ))}
    </>
  );
}
function WrapDetail({
  selected,
  market,
  saved,
  onSaved,
}: {
  selected: WrapWindow;
  market: Market | null;
  saved: WrapArchive | null;
  onSaved: () => void;
}) {
  const { client, user } = useAccount();
  const [editionID, setEditionID] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (saved) {
      if (saved.unavailable || archiveExpired(saved, Date.now()))
        throw new Error("Unavailable saved edition");
      saved.editions.forEach((e) => hydrateEdition(e, Date.now()));
      return { archive: saved, durable: true };
    }
    if (!market) throw new Error("Catalogue unavailable");
    const [result, transactions, watches] = await Promise.all([
      client!.rpc("get_market_period_evidence", {
        starts_on: selected.starts_on,
        ends_on: selected.ends_on,
        requested_kind: selected.period_type,
      }),
      ledger(client!),
      watchlist(client!, user!.id),
    ]);
    if (result.error) throw result.error;
    const { data } = await client!.auth.getSession();
    if (data.session?.user.id !== user!.id) throw new Error("Account changed");
    const edition = createEdition(
      selected,
      result.data as WrapEvidence,
      market.securities,
      transactions,
      watches,
      Date.now(),
    );
    try {
      const archive = await mutateArchive(
        user!.id,
        periodKey(selected),
        (old) => saveEdition(old, user!.id, edition, Date.now()),
      );
      if (archive.unavailable || archiveExpired(archive, Date.now()))
        throw new Error("Unavailable saved edition");
      hydrateEdition(archive.editions.at(-1)!, Date.now());
      return { archive, durable: true };
    } catch (error) {
      if (
        error instanceof DOMException &&
        ["QuotaExceededError", "SecurityError", "InvalidStateError"].includes(
          error.name,
        )
      )
        return {
          archive: saveEdition(null, user!.id, edition, Date.now()),
          durable: false,
        };
      throw error;
    }
  }, [saved, market, client, user, selected]);
  const state = useResource(load);
  useEffect(() => {
    if (state.data?.durable && !saved) onSaved();
  }, [state.data?.durable, saved, onSaved]);
  const archive = state.data?.archive;
  const current = archive?.editions.at(-1);
  const edition = archive?.editions.find((e) => e.id === editionID) || current;
  const handleRepair = useCallback(async () => {
    if (!current || !state.data?.durable || !market) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const [result, watches] = await Promise.all([
        client!.rpc("get_market_period_evidence", {
          starts_on: selected.starts_on,
          ends_on: selected.ends_on,
          requested_kind: selected.period_type,
        }),
        watchlist(client!, user!.id),
      ]);
      if (result.error) throw result.error;
      const { data } = await client!.auth.getSession();
      if (data.session?.user.id !== user!.id)
        throw new Error("Account changed");
      const now = Date.now();
      const proposal = personalizationEdition(
        current,
        watches.map((w) => w.security_id),
        {
          evidence: result.data as WrapEvidence,
          securities: market.securities,
          capturedAt: now,
        },
        now,
      );
      const next = await mutateArchive(user!.id, periodKey(selected), (old) => {
        if (!old) throw new Error("Missing archive");
        return repairEdition(old, current.id, proposal, Date.now());
      });
      setEditionID(next.editions.at(-1)!.id);
      setMessage(
        next.editions.length === archive!.editions.length
          ? "A lista já corresponde à edição guardada."
          : "Nova edição guardada. Os dados originais do mercado e da carteira foram preservados.",
      );
      onSaved();
    } catch {
      setError(
        "Não foi possível verificar a lista e os fechos originais, ou outra janela guardou uma edição mais recente. A edição anterior foi preservada.",
      );
    } finally {
      setBusy(false);
    }
  }, [
    current,
    state.data?.durable,
    market,
    client,
    selected,
    user,
    archive,
    onSaved,
  ]);
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {archive && edition && !state.error && (
        <>
          <div className="wrap-edition-bar">
            <div>
              <p className="eyebrow">
                {state.data!.durable
                  ? "EDIÇÃO GUARDADA"
                  : "EDIÇÃO DESTA CONSULTA"}
              </p>
              <h2>
                {date(selected.starts_on)} — {date(selected.ends_on)}
              </h2>
              <p className="fine-print">
                Edição {edition.edition} · criada em{" "}
                {date(new Date(edition.createdAt).toISOString(), true)} · Luanda
              </p>
            </div>
            {archive.editions.length > 1 && (
              <label>
                Edição
                <select
                  value={edition.id}
                  onChange={(e) => setEditionID(e.target.value)}
                >
                  {archive.editions.map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.edition === 1 ? "Original" : `Edição ${e.edition}`}{" "}
                      {e.repair
                        ? "· lista recriada"
                        : e.correction
                          ? "· correcção"
                          : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!state.data!.durable && (
            <p role="status" className="error-state">
              O navegador não permitiu guardar esta edição. Podes lê-la agora,
              mas o histórico e a posição de leitura não ficam guardados.
            </p>
          )}
          {edition.repair && (
            <p className="fine-print">
              A lista desta edição foi recriada em{" "}
              {date(new Date(edition.repair.capturedAt).toISOString(), true)}. A
              edição original continua disponível.
            </p>
          )}
          {edition.correction && (
            <p className="data-note">
              Correcção: {edition.correction.explanation} · Referência{" "}
              {edition.correction.sourceRevision}
            </p>
          )}
          <EditionView
            key={edition.id}
            edition={edition}
            archive={archive}
            durable={state.data!.durable}
          />
          {state.data!.durable && selected.period_type === "weekly" && (
            <div className="form-panel">
              <h3>Recriar com a lista actual</h3>
              <p>
                Cria outra edição com os instrumentos que segues agora. O
                mercado e a carteira mantêm os valores da edição original.
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  void handleRepair();
                }}
                disabled={busy || !market || edition.id !== current?.id}
              >
                {busy ? "A verificar…" : "Recriar personalização"}
              </button>
              <p className="fine-print">
                Só fica disponível quando há fechos verificados para todos os
                instrumentos da tua lista.
              </p>
            </div>
          )}
          <Feedback error={error} message={message} />
        </>
      )}
    </>
  );
}
function EditionView({
  edition,
  archive,
  durable,
}: {
  edition: WrapEdition;
  archive: WrapArchive;
  durable: boolean;
}) {
  const { user, privateMode } = useAccount();
  const { record } = usePersonalisation();
  const capture = useRef(record);
  useEffect(() => {
    capture.current = record;
  }, [record]);
  const userID = user!.id;
  const [storageError, setStorageError] = useState("");
  const completed = useRef(archive.playback[edition.id]?.completed || false);
  const lastStory = useRef<string | null>(null);
  const now = useClock();
  const rows = hydrateEdition(edition, now);
  const evidence = edition.source.evidence;
  const initialPage = Math.max(
    0,
    edition.stories.findIndex(
      (s) => s.id === archive.playback[edition.id]?.storyID,
    ),
  );
  const journal = useCallback(
    async (event: WrapEvent | null, storyID: string | null = null) => {
      if (!durable) return;
      let accepted = false;
      try {
        await mutateArchive(userID, archive.key, (old) => {
          if (!old) throw new Error("Missing edition");
          const result = recordPlayback(
            old,
            edition.id,
            event,
            storyID,
            Date.now(),
          );
          accepted = result.accepted;
          return result.record;
        });
        if (accepted && event && edition.period.period_type === "weekly")
          capture.current({ kind: event, variant: archive.key });
        if (accepted && event === "wrap_opened")
          capture.current({ kind: "wrap_open" });
      } catch {
        setStorageError(
          "A posição de leitura não pôde ser guardada neste navegador.",
        );
      }
    },
    [durable, userID, archive.key, edition.id, edition.period.period_type],
  );
  useEffect(() => {
    let active = true,
      opened = false,
      abandoned = false;
    void Promise.resolve().then(() => {
      if (active) {
        opened = true;
        void journal("wrap_available");
        void journal("wrap_opened");
      }
    });
    const abandon = () => {
      if (opened && !abandoned && !completed.current) {
        abandoned = true;
        void journal("wrap_abandoned");
      }
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      active = false;
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
  }, [journal]);
  const onPage = useCallback(
    (page: number) => {
      const id = edition.stories[page]?.id;
      if (id && lastStory.current !== id) {
        lastStory.current = id;
        void journal(null, id);
      }
    },
    [edition.stories, journal],
  );
  const onComplete = useCallback(() => {
    if (!completed.current) {
      completed.current = true;
      void journal("wrap_completed");
    }
  }, [journal]);
  const onShare = useCallback(() => {
    void journal("wrap_shared");
  }, [journal]);
  if (archiveExpired(archive, now))
    return (
      <p className="empty-state">
        Esta edição chegou ao fim do período de conservação.
      </p>
    );
  return (
    <>
      <WrapStories
        stories={edition.stories}
        period={edition.period}
        portfolioOmission={edition.portfolioOmission}
        initialPage={initialPage}
        onPage={onPage}
        onComplete={onComplete}
        onShare={onShare}
      />
      <Feedback error={storageError} />
      <section className="dashboard-panel wrap-evidence-panel">
        <h2>Os dados desta edição</h2>
        <p className="fine-print">
          Base: {date(evidence.baseline_day)}. Estes valores são históricos; não
          são cotações actuais.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Instrumento</th>
                <th>Variação</th>
                <th>Fecho inicial</th>
                <th>Fecho final</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.security.id}>
                  <td>
                    <Link href={`/mercado/${row.security.id}`}>
                      {row.security.symbol}
                    </Link>
                  </td>
                  <td className={row.change >= 0 ? "positive" : "negative"}>
                    {number(row.change)}%
                  </td>
                  <td>{priceText(row.security, row.start)}</td>
                  <td>{priceText(row.security, row.end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-note">
          Variações de preço entre a sessão de base e a última sessão do
          período. Instrumentos sem ambas as referências foram excluídos. Não
          representa rendibilidade total, dividendos ou cupões.
        </p>
        <details>
          <summary>Dados e fontes originais</summary>
          <p className="fine-print">
            Recolha: {date(evidence.fetched_at, true)} · Contrato{" "}
            {evidence.contract_version} · Calendário BODIVA verificado no
            momento da criação.
          </p>
          {rows.map((row) => (
            <p
              className="fine-print notification-provenance"
              key={row.security.id}
            >
              {row.security.symbol}: {row.records.join(" → ")}
            </p>
          ))}
        </details>
        {edition.watchSource && !privateMode && (
          <details>
            <summary>Fontes da lista recriada</summary>
            <p className="fine-print">
              Recolha: {date(edition.watchSource.evidence.fetched_at, true)}
            </p>
            {edition.watchSource.evidence.observations
              .filter((o) => edition.watchedIDs.includes(o.asset_id))
              .map((o) => (
                <p
                  className="fine-print notification-provenance"
                  key={o.record_id}
                >
                  {o.asset_id} · {date(o.observed_at)} · Registo {o.record_id}
                </p>
              ))}
          </details>
        )}
      </section>
    </>
  );
}
