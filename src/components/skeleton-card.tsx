import { cn } from "@/lib/utils";

/** Shimmer placeholder card for route-level loading states. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="skeleton-shimmer h-4 w-3/4 rounded-md" />
      <div className="skeleton-shimmer mt-3 h-3 w-1/2 rounded-md" />
      <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded-md" />
      <div className="mt-5 flex items-center justify-between">
        <div className="skeleton-shimmer h-6 w-24 rounded-full" />
        <div className="skeleton-shimmer h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Page-level shell with heading + grid of skeleton cards. */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="skeleton-shimmer h-9 w-64 rounded-lg" />
      <div className="skeleton-shimmer mt-3 h-4 w-96 max-w-full rounded-md" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
