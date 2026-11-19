import type { ReactNode } from "react";

import { PageTransition } from "@/ui/motion/page-transition";

/** Remounts on each navigation to another page here, so the old page dissolves into the new one (`PageTransition`). */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
