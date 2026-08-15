"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "deadline", label: "Deadline" },
  { value: "recent", label: "Recently Added" },
  { value: "funding", label: "Funding" },
  { value: "popular", label: "Popularity" },
];

export function ResultsToolbar({
  searchParams,
  view,
  total,
}: {
  searchParams: URLSearchParams;
  view: "grid" | "list";
  total: number;
}) {
  const router = useRouter();
  const params = new URLSearchParams(searchParams);
  const sort = params.get("sort") ?? "relevance";
  const featured = params.get("featured") === "1";

  function setParam(key: string, value: string | null) {
    const p = new URLSearchParams(params);
    if (value === null || value === "") p.delete(key);
    else p.set(key, value);
    router.push(`/scholarships${p.size ? `?${p.toString()}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        <span className="font-bold text-foreground">{total.toLocaleString()}</span>{" "}
        {total === 1 ? "Scholarship" : "Scholarships"} Found
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam("featured", featured ? null : "1")}
          aria-pressed={featured}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            featured
              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Featured only
        </button>

        <Select value={sort} onValueChange={(v) => setParam("sort", v === "relevance" ? null : v)}>
          <SelectTrigger className="h-9 w-[11rem] text-xs" aria-label="Sort results">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-lg border bg-card p-0.5" role="group" aria-label="View layout">
          <button
            type="button"
            onClick={() => setParam("view", null)}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setParam("view", "list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
