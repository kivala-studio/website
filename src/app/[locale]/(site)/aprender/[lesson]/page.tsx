import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { use } from "react";

import { LESSON_SECTIONS, lessonBySlug } from "@/features/learn/lessons";
import { MarkRead } from "@/features/learn/read-state";
import { PAGE_WIDTH } from "@/features/site/chrome";
import { pageMetadata } from "@/features/site/metadata";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Icon } from "@/ui/icons/icon";

type Props = { params: Promise<{ locale: string; lesson: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lesson: slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) return {};
  const t = await getTranslations({ locale: locale as AppLocale });
  return pageMetadata({
    locale: locale as AppLocale,
    path: `/aprender/${lesson.slug}`,
    title: t(`learn.${lesson.id}.title`),
    description: t(`learn.${lesson.id}.1.body`),
    image: "learn",
  });
}

/** One lesson (iOS `LessonView`): title and three sections; opening it marks it read on this device. */
export default function LessonPage({ params }: Props) {
  const lesson = lessonBySlug(use(params).lesson);
  if (!lesson) notFound();
  const t = useTranslations();
  return (
    <main id="main" className={cn(PAGE_WIDTH, "pt-4 pb-16")}>
      <MarkRead id={lesson.id} />
      <article className="flex max-w-170 flex-col gap-6">
        <Link
          href="/aprender"
          prefetch={false}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-small px-2 text-secondary font-semibold text-accent"
        >
          <Icon name="chevron-left" />
          {t("learn.title")}
        </Link>
        <h1 className="text-display text-primary-text">{t(`learn.${lesson.id}.title`)}</h1>
        {LESSON_SECTIONS.map((section) => (
          <section key={section} className="flex flex-col gap-2">
            <h2 className="text-section text-primary-text">{t(`learn.${lesson.id}.${section}.heading`)}</h2>
            <p className="text-body text-primary-text">{t(`learn.${lesson.id}.${section}.body`)}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
