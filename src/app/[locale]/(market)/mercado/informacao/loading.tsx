import { CardSkeleton, PageHeadingSkeleton, PageSkeleton } from "@/ui/components/page-skeleton";

/** Market information and one update on their way: the reading column of cards (inside the market layout's `<main>`). */
export default function Loading() {
  return (
    <PageSkeleton className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeadingSkeleton />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
    </PageSkeleton>
  );
}
