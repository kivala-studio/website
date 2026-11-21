import { HeroPanel } from "@/features/site/home";
import { PageSkeleton } from "@/ui/components/page-skeleton";

/** The landing on its way: the hero panel's place, one window tall, its shapes drifting, under the site header. */
export default function Loading() {
  return (
    <PageSkeleton as="main">
      <HeroPanel />
    </PageSkeleton>
  );
}
