import type { ReactNode } from "react";

import { SiteFrame } from "@/features/site/site-frame";

/** Public site chrome: header, page, footer. Plus is in the navigation here (not on `(store-linked)` pages). */
export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteFrame plus>{children}</SiteFrame>;
}
