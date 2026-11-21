import { useTranslations } from "next-intl";

import { LESSONS } from "@/features/learn/lessons";
import { ReadingPageSkeleton } from "@/features/site/pages";
import { Skeleton } from "@/ui/components/states";

/** Aprender on its way: the title and the seven lesson rows' places. */
export default function Loading() {
  const t = useTranslations();
  return (
    <ReadingPageSkeleton title={t("learn.title")}>
      <ul aria-hidden className="panel flex flex-col overflow-hidden">
        {LESSONS.map((lesson) => (
          <li key={lesson.id} className="flex min-h-15 items-center gap-4 border-b border-hairline px-5 py-3 last:border-b-0 desk:px-6">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </li>
        ))}
      </ul>
    </ReadingPageSkeleton>
  );
}
