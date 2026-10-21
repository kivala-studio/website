"use client";
import Image from "next/image";
import { createContext, useContext, useEffect, useRef } from "react";
import Icon from "./invest-icon";

type Distribution = { url: string | null; beta: boolean; qr: string | null };
const DownloadContext = createContext<Distribution | null>(null);

export function AppDownloadProvider({
  distribution,
  children,
}: {
  distribution: Distribution;
  children: React.ReactNode;
}) {
  return <DownloadContext.Provider value={distribution}>{children}</DownloadContext.Provider>;
}

export default function AppDownload() {
  const distribution = useContext(DownloadContext);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && panel.current)
        panel.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  if (!distribution?.url) return null;
  const label = distribution.beta ? "Abrir no TestFlight" : "Descarregar na App Store";
  return (
    <div className="app-download">
      <details className="app-download-desktop" ref={panel}>
        <summary aria-label="Descarregar a aplicação para iPhone">
          <Icon name="download" size={18} /><span>App para iPhone</span>
        </summary>
        <div className="app-download-panel">
          <h2>invest.ao para iPhone</h2>
          {distribution.qr && <>
            <p>Lê o código com a câmara do iPhone.</p>
            <Image src={distribution.qr} width={164} height={164} alt="QR code para descarregar a invest.ao para iPhone" unoptimized />
          </>}
          <a href={distribution.url} target="_blank" rel="noopener noreferrer">{label}<Icon name="arrow-up-right" size={16} /></a>
        </div>
      </details>
      <a className="app-download-mobile" href={distribution.url} target="_blank" rel="noopener noreferrer" aria-label={`${label} — invest.ao para iPhone`}>
        <Icon name="download" size={17} /><span>iPhone</span>
      </a>
    </div>
  );
}
