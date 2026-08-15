"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleSaveAction } from "@/app/actions";

interface SaveButtonProps {
  scholarshipId: string;
  initialSaved?: boolean;
  className?: string;
  label?: boolean;
}

export function SaveButton({ scholarshipId, initialSaved = false, className, label = false }: SaveButtonProps) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(initialSaved);

  function onClick() {
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
          ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue"
          : "border-border bg-card text-muted-foreground hover:border-brand-blue/40 hover:text-brand-blue",
        className
      )}
    >
      <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
      {label && (saved ? "Saved" : "Save")}
    </button>
  );
}
