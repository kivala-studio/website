import type { ComponentProps, HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon } from "../icons/icon";

/*
 * Data table primitives (the CoinStats list look): 60 px rows divided by hairlines, no zebra, a 14 px muted header,
 * cells in the display face, numeric columns right-aligned. Put the table in a flush `Card`/`Panel` so rows reach
 * the card edges; the first and last cells carry the card's 24 px inset.
 */

type Align = "left" | "right" | "center";
const ALIGN: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };
const EDGE = "first:pl-4 last:pr-4 desk:first:pl-6 desk:last:pr-6";

export const TABLE_HEADER_CELL = cn("h-12 px-3 font-sans text-secondary font-normal whitespace-nowrap text-secondary-text", EDGE);
export const TABLE_ROW = "relative border-b border-hairline last:border-b-0 transition-colors hover:bg-app-background/70";
export const TABLE_CELL = cn("h-15 px-3 align-middle font-display text-body text-primary-text", EDGE);

export function DataTable({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn("w-full border-collapse", className)} />;
}

/** The header row: a hairline under it, muted 14 px labels. */
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={className}>
      <tr className="border-b border-hairline">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({ align = "left", className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return <th scope="col" {...props} className={cn(TABLE_HEADER_CELL, ALIGN[align], className)} />;
}

/**
 * A header cell whose label is a link that sorts by its column (state in the URL, so it works without JavaScript).
 * The sorted column carries `aria-sort`, the primary text colour and an arrow for the direction.
 */
export function TableSortHeader({
  label,
  sort,
  href,
  align = "left",
  className,
}: {
  label: string;
  sort: "ascending" | "descending" | undefined;
  href: ComponentProps<typeof Link>["href"];
  align?: Align;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={sort} className={cn(TABLE_HEADER_CELL, ALIGN[align], className)}>
      <Link
        href={href}
        prefetch={false}
        scroll={false}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-small transition-colors hover:text-primary-text",
          align === "right" && "flex-row-reverse",
          sort && "font-medium text-primary-text",
        )}
      >
        {label}
        {sort ? <Icon name={sort === "ascending" ? "arrow-up" : "arrow-down"} scale="s" /> : null}
      </Link>
    </th>
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn(TABLE_ROW, className)} />;
}

/** A body cell; `numeric` right-aligns it (prices, changes, amounts). */
export function TableCell({ numeric = false, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td {...props} className={cn(TABLE_CELL, numeric && "text-right whitespace-nowrap", className)} />;
}

/**
 * The row header: a 32 px round logo, the name and a muted "• SYMBOL". With `href` the whole row is the link
 * (the row is `relative`; the link's overlay covers it and carries the focus ring). `stackOnPhone` puts the symbol
 * under the name below 640 px, where a narrow name column would otherwise truncate the name to nothing.
 */
export function TableNameCell({
  logo,
  name,
  symbol,
  href,
  linkProps,
  stackOnPhone = false,
  className,
}: {
  logo: ReactNode;
  name: ReactNode;
  symbol?: string;
  href?: ComponentProps<typeof Link>["href"];
  linkProps?: Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
  stackOnPhone?: boolean;
  className?: string;
}) {
  const label = (
    <>
      <span className="min-w-0 truncate font-display font-medium text-primary-text">{name}</span>
      {symbol ? (
        <span className={cn("shrink-0 font-display text-secondary-text", stackOnPhone && "max-sm:truncate max-sm:text-caption")}>
          <span aria-hidden className={cn(stackOnPhone && "max-sm:hidden")}>• </span>
          {symbol}
        </span>
      ) : null}
    </>
  );
  const content = (
    <>
      {logo}
      {stackOnPhone ? <span className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-3">{label}</span> : label}
    </>
  );
  const layout = "flex min-h-11 min-w-0 items-center gap-3";
  return (
    <th scope="row" className={cn(TABLE_CELL, "text-left font-normal", className)}>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          {...linkProps}
          className={cn(
            layout,
            "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent",
          )}
        >
          {content}
        </Link>
      ) : (
        <span className={layout}>{content}</span>
      )}
    </th>
  );
}
