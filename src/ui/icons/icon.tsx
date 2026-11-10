import type { SVGProps } from "react";

import { cn } from "../cn";
import { ICON_PACK, type IconName } from "./icon-pack";

export type { IconName } from "./icon-pack";

/** S, M, L follow the surrounding font size like the iOS symbol scales. */
const SCALE = { s: "size-[0.783em]", m: "size-[1em]", l: "size-[1.29em]" } as const;

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  scale?: keyof typeof SCALE;
  /** Accessible name. Omit for decorative icons, which are hidden from assistive technology. */
  label?: string;
};

export function Icon({ name, scale = "m", label, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={cn("inline-block shrink-0", SCALE[scale], className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      // Generated, validated markup from the iOS masters (scripts/generate-icons.mjs).
      dangerouslySetInnerHTML={{ __html: ICON_PACK[name].body }}
      {...props}
    />
  );
}
