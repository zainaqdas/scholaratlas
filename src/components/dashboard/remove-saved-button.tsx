"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleSaveAction } from "@/app/actions";

export function RemoveSavedButton({ scholarshipId }: { scholarshipId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await toggleSaveAction(scholarshipId);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
      aria-label="Remove from saved"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Remove
    </button>
  );
}
