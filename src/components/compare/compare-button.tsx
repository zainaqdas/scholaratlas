"use client";

import { useSyncExternalStore } from "react";
import { Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "sa-compare";
const CHANGE_EVENT = "sa-compare-change";

export function getCompareIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

// The compare set lives in localStorage; the button mirrors it reactively.
function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

export function CompareButton({ scholarshipId, className }: { scholarshipId: string; className?: string }) {
  const active = useSyncExternalStore(
    subscribe,
    () => getCompareIds().includes(scholarshipId),
    () => false
  );

  function toggle() {
    const ids = getCompareIds();
    const next = ids.includes(scholarshipId) ? ids.filter((i) => i !== scholarshipId) : [...ids, scholarshipId];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 6)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      title="Add to comparison"
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
        active
          ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo dark:border-indigo-400/50 dark:bg-indigo-400/15 dark:text-indigo-300"
          : "border-border bg-card text-muted-foreground hover:border-brand-indigo/40 hover:text-brand-indigo dark:hover:border-indigo-400/40 dark:hover:text-indigo-300",
        className
      )}
    >
      <Columns3 className="h-3.5 w-3.5" />
    </button>
  );
}
