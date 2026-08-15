"use client";

import { useEffect, useState } from "react";
import { Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "sa-compare";

export function getCompareIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function CompareButton({ scholarshipId, className }: { scholarshipId: string; className?: string }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(getCompareIds().includes(scholarshipId));
  }, [scholarshipId]);

  function toggle() {
    const ids = getCompareIds();
    const next = ids.includes(scholarshipId) ? ids.filter((i) => i !== scholarshipId) : [...ids, scholarshipId];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 6)));
    window.dispatchEvent(new Event("sa-compare-change"));
    setActive(next.includes(scholarshipId));
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
          ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
          : "border-border bg-card text-muted-foreground hover:border-brand-indigo/40 hover:text-brand-indigo",
        className
      )}
    >
      <Columns3 className="h-3.5 w-3.5" />
    </button>
  );
}
