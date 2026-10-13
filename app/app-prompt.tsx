/* QR is generated locally as SVG; image optimisation would add no benefit. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
type Feature = "discover" | "watchlist" | "alerts" | "compare" | "portfolio";
type Props = {
  feature: Feature;
  position: string;
  url: string | null;
  beta: boolean;
  qr: string | null;
};
const benefits: Record<Feature, [string, string, string]> = {
  discover: [
    "Acompanha o que te interessa.",
    "No iPhone, reúne os teus instrumentos, consulta o histórico e acompanha a tua carteira.",
    "Conhecer o app para iPhone",
  ],
  watchlist: [
    "Queres acompanhar este instrumento?",
    "No app, guarda-o nos favoritos e configura os teus alertas de preço.",
    "Acompanhar · No app",
  ],
  alerts: [
    "Não precisas de voltar para verificar.",
    "No app, configura regras de alerta e permite as notificações no iPhone.",
    "Configurar alertas · No app",
  ],
  compare: [
    "Compara instrumentos no app.",
    "Consulta a evolução de vários instrumentos lado a lado, por preço ou desempenho.",
    "Comparar · No app",
  ],
  portfolio: [
    "As tuas posições, num só lugar.",
    "No app, regista posições para acompanhar a composição da tua carteira.",
    "Organizar carteira · No app",
  ],
};
export function event(name: string, properties: Record<string, string>) {
  window.dispatchEvent(
    new CustomEvent("investao:analytics", {
      detail: {
        name,
        properties: {
          ...properties,
          page: window.location.pathname.split("/")[1] || "inicio",
        },
      },
    }),
  );
}
export default function AppPrompt({ feature, position, url, beta, qr }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [device, setDevice] = useState("desktop");
  const [title, description, label] = benefits[feature];
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          event("app_cta_viewed", { position, feature });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (trigger.current) observer.observe(trigger.current);
    return () => observer.disconnect();
  }, [position, feature]);
  const properties = { position, feature };
  function close() {
    dialog.current?.close();
    event("app_feature_prompt_dismissed", properties);
    trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        className="app-button"
        onClick={() => {
          const detectedDevice = /iPhone|iPod/i.test(navigator.userAgent)
            ? "iphone"
            : /Android|iPad|Mobile/i.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" &&
                  navigator.maxTouchPoints > 1)
              ? "other"
              : "desktop";
          setDevice(detectedDevice);
          dialog.current?.showModal();
          event("app_feature_prompt_opened", properties);
          if (detectedDevice === "desktop" && qr)
            event("app_qr_presented", properties);
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="app-dialog"
        aria-labelledby={`prompt-${position}-${feature}`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Fechar convite"
        >
          ×
        </button>
        <p className="eyebrow">INVEST.AO PARA IPHONE</p>
        <h2 id={`prompt-${position}-${feature}`}>{title}</h2>
        <p>{description}</p>
        {url ? (
          <>
            {device === "desktop" && qr ? (
              <figure className="qr">
                <img
                  src={qr}
                  width="180"
                  height="180"
                  alt="QR code para a distribuição oficial do app iOS"
                />
                <figcaption>Lê com a câmara do iPhone.</figcaption>
              </figure>
            ) : null}
            {device === "other" ? (
              <p>
                A experiência completa está disponível para iPhone. Podes
                continuar a consultar o site neste dispositivo.
              </p>
            ) : null}
            <a
              className="primary-link"
              href={url}
              onClick={() =>
                event("app_cta_clicked", {
                  ...properties,
                  destination: beta ? "testflight" : "app_store",
                })
              }
            >
              {beta ? "Experimentar no TestFlight" : "Ver na App Store"}{" "}
              <span aria-hidden="true">↗</span>
            </a>
          </>
        ) : (
          <p className="notice">
            O link oficial para iPhone ainda não está disponível neste site.
            Continua a consultar o mercado e as notícias aqui.
          </p>
        )}
        <button className="quiet-button" onClick={close}>
          Continuar no site
        </button>
      </dialog>
    </>
  );
}
export function Consultation({
  content,
}: {
  content: "market" | "instrument" | "news" | "article";
}) {
  useEffect(() => {
    event("public_content_viewed", { content });
  }, [content]);
  return null;
}
