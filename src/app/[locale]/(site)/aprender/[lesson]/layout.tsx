import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { lessonBySlug } from "@/features/learn/lessons";

type Props = { children: ReactNode; params: Promise<{ locale: string; lesson: string }> };

/** Settles the lesson above the page's `loading.tsx`, before any of the skeleton streams, so an unknown one stays a real 404. */
export default async function LessonLayout({ children, params }: Props) {
  if (!lessonBySlug((await params).lesson)) notFound();
  return children;
}
