"use client";

import { useEffect } from "react";

/** Progressive enhancement: all content remains visible without JavaScript. */
export default function PageMotion() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          if (preference.matches) return;
          const animation = entry.target.animate(
            [
              { opacity: 0, transform: "translateY(32px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 850,
              delay: Math.min(index * 70, 140),
              easing: "cubic-bezier(.16,1,.3,1)",
              fill: "backwards",
            },
          );
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        });
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    const stopMotion = () => {
      if (preference.matches) {
        animations.forEach((animation) => animation.cancel());
        animations.clear();
      }
    };
    // Native disclosures keep navigation usable before hydration and without JS.
    const menu = document.querySelector<HTMLDetailsElement>(".mobile-nav");
    const closeMenu = (event: Event) => {
      if ((event.target as Element).closest("a") && menu) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    menu?.addEventListener("click", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    preference.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", stopMotion);
      menu?.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return null;
}
