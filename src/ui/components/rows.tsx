"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, useEffect, useRef, useState } from "react";

import type { Numeric } from "@/domain/format";
import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { ChangeBadge, FinancialValue } from "./financial";

export type BrandColor = "blue" | "gold" | "green" | "red" | "violet";

// `on-accent` flips to near-black on the bright dark-theme fills so the monogram keeps 4.5:1; violet is dark in both themes.
const BRAND: Record<BrandColor, string> = {
  blue: "bg-accent text-on-accent",
  gold: "bg-warning text-on-accent",
  green: "bg-positive text-on-accent",
  red: "bg-negative text-on-accent",
  violet: "bg-brand-violet text-white",
};

const LOGO_SIZE = {
  s: { box: "size-8", monogram: "text-micro" },
  m: { box: "size-12", monogram: "text-caption" },
  l: { box: "size-16", monogram: "text-secondary" },
} as const;

/** Circular issuer logo; falls back to a coloured monogram when there is no image or it fails. */
export function SecurityLogo({
  symbol,
  logoUrl,
  brandColor = "blue",
  size = "m",
}: {
  symbol: string;
  logoUrl?: string | null;
  brandColor?: BrandColor;
  size?: keyof typeof LOGO_SIZE;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const showImage = logoUrl && failed !== logoUrl;
  // An image that fails before hydration never fires React's onError.
  useEffect(() => {
    const element = image.current;
    if (logoUrl && element?.complete && element.naturalWidth === 0) setFailed(logoUrl);
  }, [logoUrl]);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        LOGO_SIZE[size].box,
        showImage ? "bg-white" : BRAND[brandColor],
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote issuer logos, cached by the browser
        <img ref={image} src={logoUrl} alt="" className="size-full object-contain p-[12%]" onError={() => setFailed(logoUrl)} />
      ) : (
        <span className={cn("font-bold", LOGO_SIZE[size].monogram)}>
          {symbol.replaceAll("-", "").slice(0, 4)}
        </span>
      )}
    </span>
  );
}

type AssetRowProps = {
  symbol: string;
  name: string;
  /** Null when the price has no valid evidence: the row says so instead of showing a number. */
  price: Numeric | null;
  change?: Numeric | null;
  bond?: boolean;
  code?: string;
  logoUrl?: string | null;
  brandColor?: BrandColor;
  href?: ComponentProps<typeof Link>["href"];
};

/** Logo + symbol + name, with the price and change badge or "Preço por confirmar". */
export function AssetRow({ symbol, name, price, change, bond, code, logoUrl, brandColor, href }: AssetRowProps) {
  const t = useTranslations("common");
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <SecurityLogo symbol={symbol} logoUrl={logoUrl} brandColor={brandColor} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-body font-semibold text-primary-text">{symbol}</span>
          <span className="truncate text-secondary text-secondary-text">{name}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 max-[20rem]:items-start">
        {price === null ? (
          <span className="text-secondary text-secondary-text">{t("priceUnconfirmed")}</span>
        ) : (
          <>
            <FinancialValue value={price} bond={bond} code={code} className="text-body font-semibold" />
            {change !== null && change !== undefined ? <ChangeBadge value={change} /> : null}
          </>
        )}
      </span>
    </>
  );
  const layout = "flex min-h-20 w-full items-center gap-2 py-3 max-[20rem]:flex-col max-[20rem]:items-start";
  return href ? (
    <Link href={href} className={cn(layout, "rounded-small")} aria-description={t("openSecurityDetailsHint")}>
      {content}
    </Link>
  ) : (
    <div className={layout}>{content}</div>
  );
}

/** Icon tile + title + subtitle. */
export function FeatureRow({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-medium bg-accent-soft text-section text-accent">
        <Icon name={icon} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body font-semibold text-primary-text">{title}</span>
        <span className="text-secondary text-secondary-text">{subtitle}</span>
      </span>
    </div>
  );
}
