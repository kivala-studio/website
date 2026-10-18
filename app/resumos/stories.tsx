"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { useAccount } from "../components/account-provider";
import { ledger, watchlist } from "../../lib/account-data";
import { positions } from "../../lib/finance";
import { date, kind, number } from "../../lib/market-presentation";
import type { wrapRows, WrapWindow } from "../../lib/wrap-evidence";
import { ResourceState, useResource } from "../components/async-state";
import Icon from "../components/invest-icon";
type Row = NonNullable<ReturnType<typeof wrapRows>>[number];
type Story = {
  title: string;
  value: string;
  body: string;
  personal?: boolean;
  color?: string;
};
export default function WrapStories({
  rows,
  period,
  baseline,
}: {
  rows: Row[];
  period: WrapWindow;
  baseline: string;
}) {
  const { client, user, privateMode } = useAccount();
  const load = useCallback(async () => {
    const [transactions, watches] = await Promise.all([
      ledger(client!),
      watchlist(client!, user!.id),
    ]);
    return { transactions, watches };
  }, [client, user]);
  const state = useResource(load);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const equities = rows.filter((r) => kind(r.security) === "Acções");
  const stories: Story[] = [
    {
      title:
        period.period_type === "weekly"
          ? "A tua semana no mercado."
          : "O teu período no mercado.",
      value: `${date(period.starts_on)} — ${date(period.ends_on)}`,
      body: "Os movimentos, a tua lista e os teus investimentos. A partir de fechos verificados.",
    },
  ];
  let portfolioOmission = "";
  if (state.data) {
    const watched = rows.filter((r) =>
      state.data!.watches.some((w) => w.security_id === r.security.id),
    );
    if (watched.length)
      stories.push({
        title: "Na tua lista",
        value: `${watched.filter((r) => r.change > 0).length} subiram · ${watched.filter((r) => r.change < 0).length} desceram`,
        body: `${watched.length} de ${state.data.watches.length} instrumentos com fechos comparáveis. ${watched.filter((r) => r.change === 0).length} sem alteração.`,
        personal: true,
      });
    if (state.data.transactions.length) {
      if (
        state.data.transactions.some(
          (t) => t.traded_on > baseline && t.traded_on <= period.ends_on,
        )
      )
        portfolioOmission =
          "A carteira tem operações no período. O resumo de desempenho foi omitido para não confundir reforços ou vendas com ganhos.";
      else {
        try {
          const held = positions(
            state.data.transactions.filter((t) => t.traded_on <= baseline),
          ).filter((p) => p.quantity.gt(0));
          const covered = held.map((p) => ({
            position: p,
            row: rows.find(
              (r) =>
                r.security.id === p.securityID &&
                r.security.currency === "AOA" &&
                ["Acções", "Fundos"].includes(kind(r.security)),
            ),
          }));
          if (held.length && covered.every((p) => p.row)) {
            const initial = covered.reduce(
              (sum, p) => sum.plus(p.position.quantity.times(p.row!.start)),
              new Decimal(0),
            );
            const change = covered.reduce(
              (sum, p) =>
                sum.plus(
                  p.position.quantity.times(
                    new Decimal(p.row!.end).minus(p.row!.start),
                  ),
                ),
              new Decimal(0),
            );
            stories.push({
              title: "A tua carteira no período",
              value: `${change.gt(0) ? "+" : ""}${number(change.toNumber())} Kz`,
              body: `${number(change.div(initial).times(100).toNumber())}% de variação de preço nas posições sem operações no período. Não inclui dividendos, comissões ou impostos.`,
              personal: true,
              color: change.gte(0) ? "#35c98b" : "#ff6677",
            });
          } else if (held.length)
            portfolioOmission =
              "Faltam fechos verificados para apresentar um resumo completo da carteira.";
        } catch {
          portfolioOmission =
            "Os registos da carteira precisam de revisão antes de calcular o resumo.";
        }
      }
    }
  }
  if (equities.length) {
    stories.push({
      title: "As acções em perspectiva",
      value: `${equities.filter((r) => r.change > 0).length} subiram`,
      body: `${equities.filter((r) => r.change < 0).length} desceram e ${equities.filter((r) => r.change === 0).length} mantiveram o preço. Cobertura: ${equities.length} acções com fechos comparáveis.`,
    });
    const rising = equities.find((r) => r.change > 0),
      falling = [...equities].reverse().find((r) => r.change < 0);
    for (const row of [rising, falling])
      if (row)
        stories.push({
          title: row.security.issuers?.name || row.security.symbol,
          value: `${row.change > 0 ? "+" : ""}${number(row.change)}%`,
          body: `${row.change > 0 ? "Maior subida" : "Maior descida"} de preço entre as acções com fechos comparáveis. ${row.security.symbol} · base em ${date(baseline)}.`,
          color: row.change > 0 ? "#35c98b" : "#ff6677",
        });
  }
  stories.push({
    title: "O próximo passo é teu.",
    value: "Continua a acompanhar.",
    body: "Consulta os dados e as fontes abaixo. As variações de preço não incluem dividendos, cupões ou encargos.",
  });
  const index = Math.min(page, stories.length - 1),
    story = stories[index];
  const hidden = privateMode && story.personal;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        if (page >= stories.length - 1) setPlaying(false);
        else setPage(page + 1);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [playing, stories.length, page]);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    function visibility() {
      if (sound && document.visibilityState === "visible")
        void element!.play().catch(() => setSound(false));
      else element!.pause();
    }
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      element.pause();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sound]);
  function download() {
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[c]!,
      );
    // Deliberate export of the visible slide only. Privacy masking is preserved.
    const title = hidden ? "A tua invest.ao" : story.title,
      value = hidden ? "Valores ocultos" : story.value;
    const words = (hidden ? "Modo de privacidade activo." : story.body).split(
      " ",
    );
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + word).length > 43) {
        lines.push(line);
        line = "";
      }
      line += `${word} `;
    }
    if (line) lines.push(line);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#090b0f"/><text x="80" y="120" fill="#5a9bff" font-family="Arial,sans-serif" font-size="40">invest.ao</text><text x="80" y="240" fill="#a6afbd" font-family="Arial,sans-serif" font-size="26">${escape(date(period.starts_on))} — ${escape(date(period.ends_on))}</text><text x="80" y="420" fill="#f5f7fa" font-family="Arial,sans-serif" font-size="42" textLength="900" lengthAdjust="spacingAndGlyphs">${escape(title)}</text><text x="80" y="580" fill="${hidden ? "#a6afbd" : story.color || "#5a9bff"}" font-family="Arial,sans-serif" font-size="66" textLength="900" lengthAdjust="spacingAndGlyphs">${escape(value)}</text>${lines.map((line, i) => `<text x="80" y="${720 + i * 47}" fill="#a6afbd" font-family="Arial,sans-serif" font-size="32">${escape(line)}</text>`).join("")}<text x="80" y="1230" fill="#a6afbd" font-family="Arial,sans-serif" font-size="22">Fechos BODIVA · Variação de preço · invest.ao/resumos</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `investao-resumo-${period.starts_on}-${index + 1}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Página guardada. Revê os valores antes de partilhar.");
  }
  return (
    <section className="wrap-experience">
      <ResourceState {...state} retry={state.reload} />
      <div
        className="wrap-progress"
        aria-label={`Página ${index + 1} de ${stories.length}`}
      >
        {stories.map((_, i) => (
          <button
            key={i}
            aria-label={`Ir para página ${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            onClick={() => setPage(i)}
          />
        ))}
      </div>
      <div className="wrap-toolbar">
        <span>RESUMO INVEST.AO</span>
        <div>
          <button onClick={() => setPlaying(!playing)}>
            {playing ? "Pausar" : "Reproduzir"}
          </button>
          <button aria-pressed={sound} onClick={() => setSound(!sound)}>
            {sound ? "Silenciar" : "Activar som"}
          </button>
          <button onClick={download} aria-label="Guardar página para partilhar">
            <Icon name="share" />
          </button>
        </div>
      </div>
      <article className="wrap-slide" aria-live="polite">
        <p>
          {date(period.starts_on)} — {date(period.ends_on)}
        </p>
        <h2>{hidden ? "A tua invest.ao" : story.title}</h2>
        <strong
          style={{ color: hidden ? "#a6afbd" : story.color || "#5a9bff" }}
        >
          {hidden ? "••••••" : story.value}
        </strong>
        <p>{hidden ? "Os valores pessoais estão ocultos." : story.body}</p>
      </article>
      <div className="wrap-navigation">
        <button disabled={index === 0} onClick={() => setPage(index - 1)}>
          Anterior
        </button>
        <span>
          {index + 1} / {stories.length}
        </span>
        <button
          disabled={index === stories.length - 1}
          onClick={() => setPage(index + 1)}
        >
          Seguinte
        </button>
      </div>
      <audio
        ref={audio}
        src="/audio/weekly-wrap-theme.mp3"
        loop
        preload="none"
      />
      <p role="status">{message}</p>
      {portfolioOmission && <p className="fine-print">{portfolioOmission}</p>}
    </section>
  );
}
