"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { cn } from "@/ui/cn";
import { NavTabs, ThemeSwitch } from "@/ui/components/controls";
import { ToastHost } from "@/ui/components/feedback";
import { PAGE_CONTAINER, PageHeading } from "@/ui/components/layout";
import type { Theme } from "@/ui/theme/theme";

import { Choices } from "./choices";
import { DataDisplay } from "./data";
import { FeedbackAndStates, Overlays } from "./feedback";
import { Fields } from "./fields";
import { FormatCheck } from "./format-check";
import { Foundations } from "./foundations";
import { Landing } from "./landing";
import { MotionSection } from "./motion";
import { Navigation } from "./navigation";
import { GallerySection } from "./specimen";
import { Surfaces } from "./surfaces";

/*
 * The component library (`/dev/design`), in the order of docs/design/components.md. Development-only: never
 * built in `production` data mode (`page.dev.tsx`). Section titles, specimen names and sample instruments are
 * literal English or invented data; component strings come from the catalogue.
 */

const SECTIONS = [
  { id: "foundations", title: "Foundations" },
  { id: "motion", title: "Motion" },
  { id: "layout", title: "Layout" },
  { id: "navigation", title: "Navigation" },
  { id: "buttons", title: "Buttons" },
  { id: "fields", title: "Fields" },
  { id: "data", title: "Data" },
  { id: "overlays", title: "Overlays" },
  { id: "feedback", title: "Feedback" },
  { id: "landing", title: "Landing" },
  { id: "formatting", title: "Formatting" },
] as const;

/** The section whose top last passed under the sticky nav. */
function useCurrentSection() {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-gallery-section]")];
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = sections.find((section) => visible.get(section.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-64px 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return current;
}

export function DesignGallery({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations();
  const current = useCurrentSection();

  return (
    <ToastHost>
      <main id="main" className={cn(PAGE_CONTAINER, "flex flex-col gap-10 pb-16")}>
        <div className="flex flex-col gap-4 pt-8">
          <PageHeading title={t("designSystem.gallery.title")} eyebrow={t("designSystem.gallery.previewBadge")} />
          <div className="max-w-sm">
            <ThemeSwitch initial={initialTheme} />
          </div>
        </div>

        <div className="sticky top-0 z-20 -mx-4 bg-app-background px-4 sm:-mx-6 sm:px-6" data-testid="gallery-nav">
          <NavTabs
            label="Component library"
            items={SECTIONS.map((section) => ({ href: `/dev/design#${section.id}`, title: section.title, current: section.id === current }))}
          />
        </div>

        <Foundations />
        <MotionSection />
        <Surfaces initialTheme={initialTheme} />
        <Navigation initialTheme={initialTheme} />
        <Choices initialTheme={initialTheme} />
        <Fields />
        <DataDisplay />
        <Overlays />
        <FeedbackAndStates />
        <Landing />

        <GallerySection id="formatting" title="Formatting">
          <FormatCheck />
        </GallerySection>
      </main>
    </ToastHost>
  );
}
