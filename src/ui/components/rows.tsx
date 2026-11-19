"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
  m: { box: "size-12 desk:size-9", monogram: "text-caption desk:text-micro" },
  l: { box: "size-16 desk:size-12", monogram: "text-secondary desk:text-caption" },
  /** 48 px at every width (an instrument page's header). */
  header: { box: "size-12", monogram: "text-caption" },
} as const;

type LogoFit = "cover" | "trim" | "contain";

const FIT_CLASS: Record<LogoFit, string> = {
  cover: "object-cover",
  trim: "scale-110 object-cover",
  contain: "object-contain p-[12%]",
};

/** Each logo URL's fit, shared by every `SecurityLogo` on the page: a list measures a logo once and never flickers. */
const logoFits = new Map<string, LogoFit>();
const logoFitListeners = new Set<() => void>();
const subscribeToLogoFits = (listener: () => void) => {
  logoFitListeners.add(listener);
  return () => void logoFitListeners.delete(listener);
};

const FIT_SAMPLE = 32;

/**
 * `cover` for a (near-)square logo that is opaque to its edges and not mostly white: a solid badge that fills the
 * circle. `trim` is the same badge with a thin white strip along an edge (a loosely cropped favicon), enlarged 10 %
 * so the strip falls outside the circle. Transparent edges, a wide wordmark, a mark on white or an image the canvas
 * can't read stay contained, so the mark is never cut. Logos are same-origin, so reading the canvas is allowed.
 */
function measureLogoFit(image: HTMLImageElement): LogoFit {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height || Math.abs(width / height - 1) > 0.1) return "contain";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = FIT_SAMPLE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "contain";
    context.drawImage(image, 0, 0, FIT_SAMPLE, FIT_SAMPLE);
    const { data } = context.getImageData(0, 0, FIT_SAMPLE, FIT_SAMPLE);
    const last = FIT_SAMPLE - 1;
    let white = 0;
    let whiteEdge = false;
    for (let pixel = 0; pixel < FIT_SAMPLE * FIT_SAMPLE; pixel++) {
      const [red = 0, green = 0, blue = 0, alpha = 0] = data.subarray(pixel * 4, pixel * 4 + 4);
      const x = pixel % FIT_SAMPLE;
      const y = Math.floor(pixel / FIT_SAMPLE);
      const edge = x === 0 || y === 0 || x === last || y === last;
      if (edge && alpha < 250) return "contain";
      if (Math.min(red, green, blue) < 235) continue;
      white++;
      whiteEdge ||= edge;
    }
    if (white >= (FIT_SAMPLE * FIT_SAMPLE) / 2) return "contain";
    return whiteEdge ? "trim" : "cover";
  } catch {
    return "contain";
  }
}

function settleLogoFit(url: string, image: HTMLImageElement) {
  if (logoFits.has(url)) return;
  logoFits.set(url, measureLogoFit(image));
  for (const listener of logoFitListeners) listener();
}

/**
 * Circular issuer logo from `/api/logos/{issuer}`; falls back to a coloured monogram when there is no image or it fails.
 * A solid square logo fills the circle; any other logo sits contained on white. The image fades in once its fit is known.
 */
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
  // Undecided on the server and during hydration, so the markup matches; known at once on client navigation.
  const fit = useSyncExternalStore(
    subscribeToLogoFits,
    () => (logoUrl ? logoFits.get(logoUrl) : undefined),
    () => undefined,
  );
  // An image that loads or fails before hydration never fires React's onLoad or onError.
  useEffect(() => {
    const element = image.current;
    if (!logoUrl || !element?.complete) return;
    if (element.naturalWidth === 0) setFailed(logoUrl);
    else settleLogoFit(logoUrl, element);
  }, [logoUrl]);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        LOGO_SIZE[size].box,
        // White under the logo in both themes (iOS); the hairline keeps the circle on white cards.
        showImage ? "border border-hairline bg-white" : BRAND[brandColor],
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin issuer logos (`/api/logos/{issuer}`), cached by the CDN
        <img
          ref={image}
          src={logoUrl}
          alt=""
          className={cn(
            "size-full transition-opacity duration-base",
            FIT_CLASS[fit ?? "contain"],
            // Hidden until measured, so it never jumps from one fit to the other; without scripting it shows contained.
            !fit && "[@media(scripting:enabled)]:opacity-0",
          )}
          onLoad={(event) => settleLogoFit(logoUrl, event.currentTarget)}
          onError={() => setFailed(logoUrl)}
        />
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
  const layout = "flex min-h-20 w-full items-center gap-2 py-3 desk:min-h-14 desk:py-2 max-[20rem]:flex-col max-[20rem]:items-start";
  return href ? (
    <Link href={href} className={cn(layout, "motion-tap rounded-small")} aria-description={t("openSecurityDetailsHint")}>
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
