import type { ReactNode } from "react";

import { PortfolioRail } from "@/features/portfolio/portfolio-rail";
import { PORTFOLIO_PAGE } from "@/features/shell/route-skeletons";

/** The portfolio area: its rail on the left from 1024 px (a strip on top below), the page beside it. */
export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <div className={PORTFOLIO_PAGE}>
      <PortfolioRail />
      {children}
    </div>
  );
}
