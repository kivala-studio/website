import type { ReactNode } from "react";

import { PortfolioRail } from "@/features/portfolio/portfolio-rail";
import { SIGNED_IN_PAGE } from "@/features/shell/placeholder-page";
import { cn } from "@/ui/cn";

/** The portfolio area: its rail on the left from 1024 px (a strip on top below), the page beside it. */
export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(SIGNED_IN_PAGE, "flex flex-col gap-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8")}>
      <PortfolioRail />
      {children}
    </div>
  );
}
