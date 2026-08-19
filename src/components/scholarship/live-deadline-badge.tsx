"use client";

import type { Scholarship } from "@prisma/client";
import { useNow } from "@/hooks/use-now";
import { deadlineDaysLabel, deadlineState, deadlineToneClass } from "@/lib/scholarship";
import { cn } from "@/lib/utils";

/**
 * Live version of DeadlineBadge: computed from the visitor's own clock and
 * re-rendered every minute, so cached HTML never shows a stale countdown and
 * flips to "Closed" the moment the deadline passes.
 */
export function LiveDeadlineBadge({
  scholarship,
  className,
}: {
  scholarship: Scholarship;
  className?: string;
}) {
  const now = useNow();
  const state = scholarship.status === "EXPIRED" ? "closed" : deadlineState(scholarship, now);
  const label = state === "closed" ? "Closed" : deadlineDaysLabel(scholarship, now);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        deadlineToneClass(state),
        className
      )}
    >
      {label}
    </span>
  );
}

/** Live status dot, same semantics as the server DeadlineDot but clock-driven. */
export function LiveDeadlineDot({ scholarship }: { scholarship: Scholarship }) {
  const now = useNow();
  const state = scholarship.status === "EXPIRED" ? "closed" : deadlineState(scholarship, now);
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

/**
 * Live ticking countdown for deadline-tracker rows: "3 days, 4 hrs left",
 * "Tomorrow", "Closing today" or "Closed" — recomputed from the visitor's clock.
 */
export function LiveDeadlineLabel({
  deadline,
  className,
}: {
  deadline: Date | string | null | undefined;
  className?: string;
}) {
  const now = useNow(30_000);
  if (!deadline) return null;
  const target = typeof deadline === "string" ? new Date(deadline) : deadline;
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return <span className={className}>Closed</span>;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days === 0) return <span className={className}>{hours > 0 ? `${hours} hrs left` : "Closing today"}</span>;
  if (days === 1) return <span className={className}>Tomorrow</span>;
  return (
    <span className={className}>
      {days} days, {hours} hrs left
    </span>
  );
}
