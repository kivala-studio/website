"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "../components/account-provider";
import { date } from "../../lib/market-presentation";
import type { WrapWindow } from "../../lib/wrap-evidence";
import type { Story } from "./content";
import Icon from "../components/invest-icon";
export default function WrapStories({
  stories,
  period,
  portfolioOmission,
  initialPage = 0,
  onPage,
  onComplete,
  onShare,
}: {
  stories: Story[];
  period: WrapWindow;
  portfolioOmission: string;
  initialPage?: number;
  onPage?: (page: number) => void;
  onComplete?: () => void;
  onShare?: () => void;
}) {
  const { privateMode } = useAccount();
  const [page, setPage] = useState(initialPage);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const index = Math.min(page, stories.length - 1),
    story = stories[index];
  const hidden = privateMode && story.personal;
  useEffect(() => {
    onPage?.(index);
  }, [index, onPage]);
  useEffect(() => {
    if (index !== stories.length - 1) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) onComplete?.();
    }, 1000);
    return () => clearTimeout(timer);
  }, [index, stories.length, onComplete]);
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
    onShare?.();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Página guardada. Revê os valores antes de partilhar.");
  }
  return (
    <section className="wrap-experience">
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
      {portfolioOmission && !privateMode && (
        <p className="fine-print">{portfolioOmission}</p>
      )}
    </section>
  );
}
