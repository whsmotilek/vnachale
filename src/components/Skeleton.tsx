import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function OrdersSkeleton() {
  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="p-3 border-b border-line bg-surface-alt">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-3 py-3 border-t border-line flex items-center gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-2.5 w-16 mb-3" />
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}
