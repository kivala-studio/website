import type { IconName } from "@/ui/icons/icon";

/*
 * The seven lessons of iOS `LearnLesson`, in its order. The text is the iOS catalogue's
 * (`learn.{id}.title`, `learn.{id}.{1…3}.heading|body`), carried in messages/*.json by `npm run messages`,
 * so it stays equal to the app bundle; this module only adds what the web needs: a Portuguese URL slug and an icon.
 */
export const LESSONS = [
  { id: "bodiva", slug: "bodiva", icon: "markets" },
  { id: "shares", slug: "acoes", icon: "trend-up" },
  { id: "bonds", slug: "obrigacoes", icon: "document" },
  { id: "quote", slug: "ler-uma-cotacao", icon: "chart" },
  { id: "income", slug: "dividendos-e-cupoes", icon: "calendar" },
  { id: "orders", slug: "comprar-e-vender", icon: "exchange" },
  { id: "risk", slug: "risco-e-diversificacao", icon: "shield-check" },
] as const satisfies readonly { id: string; slug: string; icon: IconName }[];

export type Lesson = (typeof LESSONS)[number];
export type LessonID = Lesson["id"];

/** Every lesson has three sections. */
export const LESSON_SECTIONS = [1, 2, 3] as const;

export const lessonBySlug = (slug: string): Lesson | undefined => LESSONS.find((lesson) => lesson.slug === slug);

/** Lessons opened on this device (iOS `@AppStorage("investao.learn.read")`): ids, comma separated, sorted. */
export const READ_STORAGE_KEY = "investao.learn.read";

export const parseRead = (value: string | null): Set<string> => new Set((value ?? "").split(",").filter(Boolean));

export const serializeRead = (read: Set<string>) => [...read].sort().join(",");
