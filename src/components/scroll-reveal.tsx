"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ScrollReveal — reveals `.reveal-on-scroll` elements as they enter the
 * viewport, so sections "roll up" while scrolling instead of sitting static.
 *
 * How it stays safe:
 * - Elements are only hidden AFTER this component hydrates (the `.reveal-ready`
 *   class is applied from JS), so no-JS visitors and crawlers always see the
 *   full static layout — nothing is ever hidden without JS.
 * - Elements already in the viewport at load are revealed immediately
 *   (no flash of hidden content above the fold).
 * - Fully disabled under prefers-reduced-motion.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;

    const reveal = (el: Element) => {
      el.classList.add("reveal-in");
      observer?.unobserve(el);
    };

    const scan = () => {
      const els = document.querySelectorAll<HTMLElement>(".reveal-on-scroll:not(.reveal-ready)");
      if (!els.length) return;

      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) reveal(entry.target);
            }
          },
          // Reveal when the element is ~10% in, slightly before it fully enters.
          { threshold: 0.1, rootMargin: "0px 0px -48px 0px" }
        );
      }

      const vh = window.innerHeight;
      for (const el of els) {
        el.classList.add("reveal-ready");
        const rect = el.getBoundingClientRect();
        // Already on screen (or above it after a scroll-back): show immediately.
        if (rect.top < vh && rect.bottom > 0) reveal(el);
        else observer.observe(el);
      }
    };

    scan();
    // Catch anything added after mount (client-side navigation, late hydration).
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutation.disconnect();
      observer?.disconnect();
      observer = null;
    };
  }, [pathname]);

  return null;
}
