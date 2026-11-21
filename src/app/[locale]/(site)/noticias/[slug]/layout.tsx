import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { article } from "./article";

type Props = { children: ReactNode; params: Promise<{ locale: string; slug: string }> };

/** Settles the article above the page's `loading.tsx`, before any of the skeleton streams, so an unpublished one stays a real 404. */
export default async function ArticleLayout({ children, params }: Props) {
  if ((await article((await params).slug)) === undefined) notFound();
  return children;
}
