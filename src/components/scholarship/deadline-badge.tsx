import { Badge } from "@/components/ui/badge";
import { deadlineDaysLabel, deadlineState, deadlineToneClass } from "@/lib/scholarship";
import type { Scholarship } from "@prisma/client";
import { cn } from "@/lib/utils";

export function DeadlineBadge({ scholarship, className }: { scholarship: Scholarship; className?: string }) {
  const state = deadlineState(scholarship);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        deadlineToneClass(state),
        className
      )}
    >
      {deadlineDaysLabel(scholarship)}
    </span>
  );
}

export function DeadlineDot({ scholarship }: { scholarship: Scholarship }) {
  const state = deadlineState(scholarship);
  const color =
    state === "closed" || state === "urgent"
      ? "bg-red-500"
      : state === "soon"
        ? "bg-amber-500"
        : state === "ok"
          ? "bg-emerald-500"
          : "bg-slate-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} aria-hidden="true" />;
}
