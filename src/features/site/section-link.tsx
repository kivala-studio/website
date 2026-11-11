"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";

/** A header link marked as current on its section's pages (`/mercado` and `/mercado/…`). */
export function SectionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const inSection = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={pathname === href ? "page" : inSection ? "true" : undefined}
      className={cn(className, inSection ? "text-accent" : "text-primary-text")}
    >
      {children}
    </Link>
  );
}
