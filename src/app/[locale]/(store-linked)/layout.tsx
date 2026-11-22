import type { ReactNode } from "react";

import { SiteFrame } from "@/features/site/site-frame";

/**
 * Pages the iOS app (`/policy`) and the store listings (terms, support, account deletion) open. App Store rules: no
 * link to the web offer, no price and no Plus promotion here, so the header and the footer leave Plus out.
 */
export default function StoreLinkedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteFrame plus={false}>{children}</SiteFrame>;
}
