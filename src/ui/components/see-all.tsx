import { useTranslations } from "next-intl";

import { ButtonLink } from "./buttons";

/** A card header's `Ver tudo` pill (CoinStats "See more"): the outline compact pill to the full list. */
export function SeeAll({ href }: { href: string }) {
  const t = useTranslations();
  return (
    <ButtonLink href={href} kind="outline" size="compact">
      {t("common.viewAll")}
    </ButtonLink>
  );
}
