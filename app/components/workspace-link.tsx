"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useAccount } from "./account-provider";
import { signInPath } from "../../lib/navigation";
import { isPublicBrowsePath } from "../../lib/public-routes";

/** Public discovery navigates directly; only personal tools require an account. */
export default function WorkspaceLink({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { user } = useAccount();
  const needsAccount = !user && !isPublicBrowsePath(href);
  const destination = needsAccount ? signInPath(href) : href;
  // Market-backed pages should fetch on navigation, rather than all at once.
  return (
    <Link
      {...props}
      href={destination}
      prefetch={user ? props.prefetch ?? false : false}
      onClick={(event) => {
        onClick?.(event);
        if (
          needsAccount && !event.defaultPrevented && event.button === 0 &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
          (!event.currentTarget.target || event.currentTarget.target === "_self") &&
          window.location.pathname === "/"
        ) {
          event.preventDefault();
          // Next's History API integration updates useSearchParams without refetching prices.
          window.history.pushState(null, "", destination);
        }
      }}
    />
  );
}
