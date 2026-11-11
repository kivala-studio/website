"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

import { Icon } from "@/ui/icons/icon";

import { type LessonID, READ_STORAGE_KEY, parseRead, serializeRead } from "./lessons";

const listeners = new Set<() => void>();

function readValue(): string {
  try {
    return window.localStorage.getItem(READ_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** A check mark once this device has opened the lesson; nothing on the server. */
export function ReadMark({ id }: { id: LessonID }) {
  const t = useTranslations();
  const value = useSyncExternalStore(subscribe, readValue, () => "");
  return parseRead(value).has(id) ? <Icon name="check-circle" label={t("learn.read")} className="text-positive" /> : null;
}

/** Records the lesson as read on this device when it is shown. */
export function MarkRead({ id }: { id: LessonID }) {
  useEffect(() => {
    const read = parseRead(readValue());
    if (read.has(id)) return;
    read.add(id);
    try {
      window.localStorage.setItem(READ_STORAGE_KEY, serializeRead(read));
    } catch {
      // Storage unavailable (private mode): the mark is a convenience only.
    }
    for (const listener of listeners) listener();
  }, [id]);
  return null;
}
