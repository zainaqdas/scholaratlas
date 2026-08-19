"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleSaveAction } from "@/app/actions";
import { useSavedIds } from "@/components/saved-state";

interface SaveButtonProps {
  scholarshipId: string;
  initialSaved?: boolean;
  className?: string;
  label?: boolean;
}

export function SaveButton({ scholarshipId, initialSaved = false, className, label = false }: SaveButtonProps) {
  const [pending, startTransition] = useTransition();
  // Static pages can't know the per-user saved set at render time — hydrate it
  // from the SavedStateProvider when present; dynamic pages pass initialSaved.
  // Keep syncing until the user interacts so the provider's async fetch lands.
  const savedIds = useSavedIds();
  const touched = useRef(false);
  const [saved, setSaved] = useState(initialSaved || savedIds.has(scholarshipId));

  useEffect(() => {
    if (!touched.current) setSaved(initialSaved || savedIds.has(scholarshipId));
  }, [savedIds, scholarshipId, initialSaved]);

  function onClick() {
    touched.current = true;
    startTransition(async () => {
      const res = await toggleSaveAction(scholarshipId);
      setSaved(res.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save scholarship"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        saved
          ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue dark:border-blue-400/50 dark:bg-blue-400/15 dark:text-blue-300"
          : "border-border bg-card text-muted-foreground hover:border-brand-blue/40 hover:text-brand-blue dark:hover:border-blue-400/40 dark:hover:text-blue-300",
        className
      )}
    >
      <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
      {label && (saved ? "Saved" : "Save")}
    </button>
  );
}
