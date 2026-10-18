"use client";
import { useEffect } from "react";
export function event(name: string, properties: Record<string, string>) {
  window.dispatchEvent(
    new CustomEvent("investao:analytics", {
      detail: {
        name,
        properties: {
          ...properties,
          page: window.location.pathname.split("/")[1] || "inicio",
        },
      },
    }),
  );
}
export function Consultation({
  content,
}: {
  content: "market" | "instrument" | "news" | "article";
}) {
  useEffect(() => {
    event("public_content_viewed", { content });
  }, [content]);
  return null;
}
