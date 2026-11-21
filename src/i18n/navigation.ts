import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

export const { redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/** next-intl's localised link with the app's pending state and `prefetch="intent"` (`./link.tsx`). */
export { Link, useDestinationPathname, usePendingPathname } from "./link";
