import { useTranslations } from "next-intl";
import { getImageProps, type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { preload } from "react-dom";

import { cn } from "@/ui/cn";

import { APP_STORE_URL } from "./site";

/** The App Store is the only store until the Android app exists. */
export function StoreButton({ className }: { className?: string }) {
  const t = useTranslations("site.store");
  return (
    <a
      href={APP_STORE_URL}
      className={cn(
        "motion-press inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-6 py-4 text-center text-body font-semibold text-on-accent",
        className,
      )}
    >
      {t("download")}
    </a>
  );
}

const SCREEN = "aspect-[720/1309] w-full overflow-hidden rounded-[2rem]";

/** A phone outline (iOS onboarding uses the card outline) around a screen, with the illustrative-data label. */
export function PhoneFigure({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations("onboarding.preview");
  return (
    <figure className={cn("flex w-full max-w-[18rem] flex-col items-center gap-3", className)}>
      <div className="w-full rounded-[2.5rem] border border-card-outline bg-elevated-background p-2">
        {children}
      </div>
      <figcaption className="text-micro font-medium uppercase text-tertiary-text">{t("illustrativeExample")}</figcaption>
    </figure>
  );
}

/**
 * App screenshot through the Next.js image optimiser. `getImageProps` instead of `<Image>`, because the
 * component sets an inline `style` attribute that the nonce-based CSP blocks.
 */
export function Screenshot({ image, alt, eager = false }: { image: StaticImageData; alt: string; eager?: boolean }) {
  const sizes = "(min-width: 768px) 18rem, 80vw";
  const { props } = getImageProps({ src: image, alt, sizes, loading: eager ? "eager" : "lazy" });
  const { style, ...imgProps } = props;
  void style;
  if (eager) {
    preload(imgProps.src, { as: "image", imageSrcSet: imgProps.srcSet, imageSizes: sizes, fetchPriority: "high" });
  }
  // eslint-disable-next-line @next/next/no-img-element -- optimised via getImageProps; see above.
  return <img {...imgProps} alt={alt} fetchPriority={eager ? "high" : undefined} className={cn(SCREEN, "block h-auto bg-app-background")} />;
}

/** Offline portfolio artwork, as in the iOS introduction: sample values only, never account data. */
export function PortfolioIllustration({ label }: { label: string }) {
  const t = useTranslations();
  return (
    <div role="img" aria-label={label} className={cn(SCREEN, "flex flex-col gap-1 bg-app-background px-5 pt-8")}>
      <div aria-hidden className="flex flex-col gap-1">
        <p className="text-display text-primary-text">{t("common.portfolio")}</p>
        <p className="text-micro font-medium uppercase text-tertiary-text">{t("onboarding.preview.illustrativeExample")}</p>
        <p className="mt-6 text-price text-primary-text">{t("onboarding.preview.portfolioValue")}</p>
        <p className="text-caption text-secondary-text">{t("onboarding.preview.manualRecord")}</p>
        <svg viewBox="0 0 240 120" className="mt-6 w-full" focusable="false">
          <path
            d="M0 100 L20 96 L40 98 L60 86 L80 88 L100 74 L120 78 L140 64 L160 66 L180 54 L200 58 L220 42 L240 34 L240 120 L0 120 Z"
            className="fill-accent-soft"
          />
          <path
            d="M0 100 L20 96 L40 98 L60 86 L80 88 L100 74 L120 78 L140 64 L160 66 L180 54 L200 58 L220 42 L240 34"
            className="fill-none stroke-accent"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <p className="mt-6 text-body font-semibold text-primary-text">{t("common.allocation")}</p>
        <div className="mt-2 flex h-2 gap-1">
          <span className="w-[70%] rounded-full bg-accent" />
          <span className="flex-1 rounded-full bg-accent-soft" />
        </div>
        <div className="mt-3 flex flex-col gap-2 text-caption text-secondary-text">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
            {t("common.stocks")}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent-soft" />
            {t("common.bonds")}
          </span>
        </div>
      </div>
    </div>
  );
}
