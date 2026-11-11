import type { ReactNode } from "react";

import { AreaMessages } from "@/i18n/area-messages";

/** Account entry: no site chrome, like the iOS sign-in screen. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AreaMessages area="auth">{children}</AreaMessages>;
}
