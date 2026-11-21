import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { CardSkeleton } from "@/ui/components/page-skeleton";

/** Settings and the account page on their way: the reading column of setting groups. */
export default function Loading() {
  return (
    <SignedInPageSkeleton narrow>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
    </SignedInPageSkeleton>
  );
}
