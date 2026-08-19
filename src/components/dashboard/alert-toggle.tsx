"use client";

import { useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { setAlertAction } from "@/app/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS_OPTIONS = [
  { value: "3", label: "3 days before" },
  { value: "7", label: "7 days before" },
  { value: "14", label: "14 days before" },
];

export function AlertToggle({
  scholarshipId,
  initialDaysBefore,
}: {
  scholarshipId: string;
  initialDaysBefore: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const enabled = initialDaysBefore !== null;

  function toggle() {
    startTransition(async () => {
      await setAlertAction(scholarshipId, enabled ? null : 7);
    });
  }

  function changeDays(value: string) {
    startTransition(async () => {
      await setAlertAction(scholarshipId, Number(value));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={enabled}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          enabled
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
            : "text-muted-foreground hover:border-blue-200 hover:text-blue-600"
        }`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        {enabled ? "Reminder on" : "Remind me"}
      </button>
      {enabled && (
        <Select value={String(initialDaysBefore)} onValueChange={changeDays} disabled={pending}>
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="Reminder timing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
