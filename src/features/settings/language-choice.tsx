"use client";

import { useLocale } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { SegmentedControl } from "@/ui/components/controls";

// Each language by its own name, as the iOS row shows it.
const LANGUAGES = [
  { value: "pt", title: "Português" },
  { value: "en", title: "English" },
] as const;

/** The page language; the same page reloads in the other one. */
export function LanguageChoice({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <SegmentedControl
      label={label}
      value={locale === "en" ? "en" : "pt"}
      options={LANGUAGES}
      onChange={(next) => router.replace(pathname, { locale: next })}
    />
  );
}
