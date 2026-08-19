"use client";

import { useEffect, useState } from "react";

/**
 * Current time, re-rendering every `intervalMs`. Used by the live deadline
 * countdowns so cached (ISR) pages still show accurate, self-updating labels —
 * when a deadline passes, the component re-renders and flips to "Closed"
 * without any server round-trip. Respects prefers-reduced-motion implicitly:
 * this is a state update, not an animation.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
