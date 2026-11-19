import { type ReactNode, ViewTransition } from "react";

/**
 * Navigation to another page: the new page is there at once, under a snapshot of the old one that fades out
 * (`page-exit` in motion.css), so the page dissolves into the next while everything the two share (the app bar, the
 * tab bar, the site header) stays exactly where it is: identical pixels fading over identical pixels do not change.
 *
 * Only the leaving page is a view-transition participant; the new one is the live document, so it takes clicks from
 * the first frame. Used twice: in each route group's `template.tsx` (another page in the same group) and around
 * each group's layout (a page in another group, where the whole frame is rebuilt). A change of query on the same
 * page (a sort, a filter) is not a navigation to another page and animates in place.
 *
 * Nothing plays on load, on the browser's back and forward cache restore, or with reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
