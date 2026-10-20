"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useAccount } from "./account-provider";
import { signInPath } from "../../lib/navigation";

/** Guests enter through the landing modal; signed-in visitors go straight to the app. */
export default function WorkspaceLink({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { user } = useAccount();
  const destination = user ? href : signInPath(href);
  // Market-backed pages should fetch on navigation, rather than all at once.
  return (
    <Link
      {...props}
      href={destination}
      prefetch={user ? props.prefetch ?? false : false}
      onClick={(event) => {
        onClick?.(event);
        if (
          !user && !event.defaultPrevented && event.button === 0 &&
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
