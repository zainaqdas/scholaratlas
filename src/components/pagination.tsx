"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  basePath: string;
  searchParams: URLSearchParams;
}

export function Pagination({ page, pageCount, basePath, searchParams }: PaginationProps) {
  const router = useRouter();

  function go(p: number) {
    const params = new URLSearchParams(searchParams);
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    router.push(`${basePath}${params.size ? `?${params.toString()}` : ""}`, { scroll: true });
  }

  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const window = pages.filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1
  );
  const withGaps: (number | "…")[] = [];
  window.forEach((p, i) => {
    if (i > 0 && p - window[i - 1] > 1) withGaps.push("…");
    withGaps.push(p);
  });

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <Button variant="outline" size="iconSm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {withGaps.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "h-8 w-8 rounded-lg text-sm font-medium transition-colors",
              p === page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p}
          </button>
        )
      )}
      <Button variant="outline" size="iconSm" disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
