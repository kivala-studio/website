import type { ReactNode } from "react";

import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { cn } from "@/ui/cn";

/*
 * Gallery scaffolding. Development-only: specimen names, variant labels and sample instruments are literal
 * English or invented data, not product copy. Literal class names throughout so Tailwind generates them; inline
 * styles are blocked by the CSP.
 */

/** One group of the library, an anchor of the section nav (`#id`). */
export function GallerySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-gallery-section className="flex scroll-mt-16 flex-col gap-8 border-t border-hairline pt-8 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 id={`${id}-title`} className="text-display text-primary-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A titled specimen: the component's name in code, then its variants. */
export function Specimen({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="font-mono text-secondary font-semibold text-primary-text">{name}</h3>
      <div className={cn("flex min-w-0 flex-col gap-4", className)}>{children}</div>
    </div>
  );
}

/** One variant or state inside a specimen, captioned with the props that produce it. */
export function Variant({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-2", className)}>
      <span className="font-mono text-caption text-secondary-text">{label}</span>
      {children}
    </div>
  );
}

/** Two specimens per row from 768 px. */
export const SPECIMEN_GRID = "grid grid-cols-1 gap-10 md:grid-cols-2";

/** The class a forced focus state adds, so the ring shows without focus. */
export const FORCED_RING = "outline-2 outline-offset-2 outline-accent";
/** The class a forced field focus adds. */
export const FORCED_FIELD_FOCUS = "border-accent! shadow-focus";

export const SAMPLE_INSTRUMENTS = [
  { symbol: "BAIAAAAA", name: "Banco Angolano de Investimentos", price: "65000", change: "2.14", volume: "1240", color: "blue" },
  { symbol: "BFAAAAAA", name: "Banco de Fomento Angola", price: "72500", change: "-0.62", volume: "310", color: "green" },
  { symbol: "ENSAAAAA", name: "ENSA Seguros de Angola", price: "21000", change: "0", volume: "0", color: "violet" },
] as const;

/** Catalogue rows as the server sends them: one with a dated verified close, one without any price. */
export const SAMPLE_ROWS: readonly CatalogueRow[] = [
  {
    id: "sample-close",
    symbol: "BCGAAAAA",
    name: "Banco Caixa Geral Angola",
    issuer: "Banco Caixa Geral Angola",
    kind: "equity",
    bond: false,
    currency: "AOA",
    close: { price: "48000", date: "2026-11-17", change: "1.2" },
  },
  {
    id: "sample-none",
    symbol: "OT-NR-2030",
    name: "Obrigação do Tesouro 2030",
    issuer: "Tesouro Nacional",
    kind: "treasuryBond",
    bond: true,
    currency: "AOA",
  },
];
