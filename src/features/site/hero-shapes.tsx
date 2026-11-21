"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/ui/cn";
import { prefersReducedMotion } from "@/ui/motion/tokens";

const SCENE = "/rive/hero.riv";
const RUNTIME = "/rive-runtime";
/** Below 640 px the scene is laid out a third larger and scaled down, so the shapes match the static ones' phone sizes. */
const PHONE_SCALE = 0.75;

/**
 * The hero panel's three drifting shapes. Server markup is the still shapes; on a screen that allows motion the
 * Rive scene (`rive/hero`, one 20 s loop) loads when the browser is idle and fades in over them, and plays only while
 * the panel is on screen. Without JavaScript, with reduced motion, or if the scene fails to load, the still shapes stay.
 */
export function HeroShapes() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const target = canvas.current;
    if (!target || prefersReducedMotion()) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      const { Fit, Layout, Rive, RuntimeLoader } = await import("@rive-app/canvas");
      if (cancelled) return;
      RuntimeLoader.setWasmUrl(`${RUNTIME}/rive.wasm`);
      RuntimeLoader.setWasmFallbackUrl(`${RUNTIME}/rive_fallback.wasm`);
      const phones = window.matchMedia("(max-width: 39.9375rem)");
      const layout = () => new Layout({ fit: Fit.Layout, layoutScaleFactor: phones.matches ? PHONE_SCALE : 1 });
      const rive = new Rive({
        src: SCENE,
        canvas: target,
        layout: layout(),
        autoplay: true,
        stateMachine: "State Machine 1",
        onLoad: () => {
          rive.resizeDrawingSurfaceToCanvas();
          setLive(true);
        },
      });
      const fit = () => {
        rive.layout = layout();
        rive.resizeDrawingSurfaceToCanvas();
      };
      const resize = new ResizeObserver(fit);
      resize.observe(target);
      const visible = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? rive.play() : rive.pause()));
      visible.observe(target);
      stop = () => {
        resize.disconnect();
        visible.disconnect();
        rive.cleanup();
      };
      if (cancelled) stop();
    };

    // A failed load (blocked or offline) leaves the still shapes in place.
    const run = () => void start().catch(() => undefined);
    const idle = window.requestIdleCallback?.(run, { timeout: 2000 }) ?? window.setTimeout(run, 300);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop?.();
    };
  }, []);

  const still = cn("absolute transition-opacity duration-slow", live && "opacity-0");
  return (
    <>
      <span className={cn(still, "-bottom-32 -left-24 size-72 rounded-full bg-stage-brand/30 sm:size-96")} />
      <span className={cn(still, "-top-14 -right-12 size-44 rotate-12 rounded-[3rem] bg-stage-brand/45 sm:size-56 lg:right-[8%]")} />
      <span className={cn(still, "top-[16%] left-[7%] hidden h-12 w-28 -rotate-6 rounded-full bg-on-stage-deep/10 md:block")} />
      <canvas ref={canvas} className={cn("absolute inset-0 size-full transition-opacity duration-slow", !live && "opacity-0")} />
    </>
  );
}
