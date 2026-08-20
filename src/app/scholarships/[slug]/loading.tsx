export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="skeleton-shimmer h-4 w-40 rounded-md" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="skeleton-shimmer h-10 w-3/4 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-1/2 rounded-md" />
          <div className="skeleton-shimmer mt-6 h-40 rounded-2xl" />
          <div className="skeleton-shimmer h-40 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton-shimmer h-64 rounded-2xl" />
          <div className="skeleton-shimmer h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
