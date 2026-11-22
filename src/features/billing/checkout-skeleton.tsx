import { Card } from "@/ui/components/layout";
import { Skeleton } from "@/ui/components/states";

/** The purchase card still loading, shaped like `CheckoutForm`: the plan track, the price, the method track and the button. */
export function CheckoutSkeleton() {
  return (
    <Card aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-13 w-full rounded-medium" />
        <Skeleton className="h-12 w-56" />
      </div>
      <div className="flex flex-col gap-4 border-t border-hairline pt-6">
        <Skeleton className="h-13 w-full rounded-medium" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full rounded-medium desk:h-11" />
      </div>
      <Skeleton className="h-14 w-full rounded-full desk:h-11" />
    </Card>
  );
}
