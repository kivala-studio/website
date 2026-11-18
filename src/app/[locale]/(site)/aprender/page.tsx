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
        <ul className="panel flex flex-col overflow-hidden">
          {LESSONS.map((lesson) => (
            <li key={lesson.id} className="border-b border-hairline last:border-b-0">
              <Link
                href={`/aprender/${lesson.slug}`}
                prefetch={false}
                className="flex min-h-15 items-center gap-4 px-5 py-3 transition-colors outline-offset-[-2px] hover:bg-app-background/70 desk:px-6"
                data-testid="lesson-row"
              >
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon name={lesson.icon} scale="s" />
                </span>
                <span className="flex-1 font-display text-body font-medium text-primary-text">{t(`learn.${lesson.id}.title`)}</span>
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
