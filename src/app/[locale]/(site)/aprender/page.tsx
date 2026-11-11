import { useTranslations } from "next-intl";

import { LESSONS } from "@/features/learn/lessons";
import { ReadMark } from "@/features/learn/read-state";
import { siteMetadata } from "@/features/site/metadata";
import { ReadingPage } from "@/features/site/pages";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { AreaMessages } from "@/i18n/area-messages";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons/icon";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.learn, image: "learn" }, (t) => ({
  title: t("learn.title"),
  description: t("site.meta.learnDescription"),
}));

/** The seven lessons (iOS `LearnView`), with a mark on those opened on this device. */
export default function LearnPage() {
  const t = useTranslations();
  return (
    <ReadingPage title={t("learn.title")}>
      <AreaMessages area="learn">
        <ul className="flex flex-col gap-3">
          {LESSONS.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/aprender/${lesson.slug}`}
                prefetch={false}
                className="flex min-h-14 items-center gap-3 rounded-large bg-elevated-background p-4"
                data-testid="lesson-row"
              >
                <Icon name={lesson.icon} className="w-7 text-accent" />
                <span className="flex-1 text-secondary font-semibold text-primary-text">{t(`learn.${lesson.id}.title`)}</span>
                <ReadMark id={lesson.id} />
                <Icon name="chevron-right" className="text-secondary-text" />
              </Link>
            </li>
          ))}
        </ul>
      </AreaMessages>
      <p className="text-caption text-secondary-text">{t("learn.disclaimer")}</p>
    </ReadingPage>
  );
}
