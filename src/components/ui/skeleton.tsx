export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-surface-2 ${className}`} aria-hidden />;
}

export function CardsSkeleton({ n = 3, title = true }: { n?: number; title?: boolean }) {
  return (
    <div>
      {title && <Skeleton className="mb-6 h-8 w-40 rounded-sm" />}
      <div className="grid gap-2">
        {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </div>
  );
}
