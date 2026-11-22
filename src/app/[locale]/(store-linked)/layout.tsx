import type { ReactNode } from "react";

import { SiteFrame } from "@/features/site/site-frame";

/**
 * Pages the iOS app opens or creates links to (`/policy`, shared portfolios at `/partilha/[token]`) and the store
 * listings open (terms, support, account deletion). App Store rules: no link to the web offer, no price and no Plus
 * promotion here, so the header and the footer leave Plus out.
 */
export default function StoreLinkedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteFrame plus={false}>{children}</SiteFrame>;
}
