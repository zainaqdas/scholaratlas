"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Slim progress bar pinned to the top of the viewport. Because Next.js
 * App-Router navigations are client-side, there is no full-page reload to give
 * feedback — this bar flashes while a route is resolving so a click never
 * feels "stuck". Driven purely by pathname changes; zero external deps.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    // Kick off the bar on the new pathname.
    setVisible(true);
    setProgress(20);
    // Quickly reach ~90%, then fade out — the page content is already here by
    // the time the pathname changes (App Router streams the new page in).
    let p = 20;
    timer.current = setInterval(() => {
      p = Math.min(90, p + (90 - p) * 0.25);
      setProgress(p);
    }, 90);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [pathname]);

  // When the page settles (next paint after the new pathname), finish + hide.
  useEffect(() => {
    if (!visible) return;
    const settle = setTimeout(() => {
      setProgress(100);
      const hide = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(hide);
    }, 350);
    return () => clearTimeout(settle);
  }, [pathname, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
