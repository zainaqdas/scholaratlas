import { DEMO_NOTICE } from "@/lib/constants";

export function DemoBanner() {
  return (
    <div className="relative z-40 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
      {DEMO_NOTICE}
    </div>
  );
}
