import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 pb-nav">
      <div className="px-4 pt-4"><Skeleton className="h-4 w-20 rounded-sm" /><Skeleton className="mt-3 h-7 w-48 rounded-sm" /><div className="mt-4 grid grid-cols-3 gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div></div>
      <div className="mt-5 border-b border-border px-4 pb-3"><Skeleton className="h-5 w-full rounded-sm" /></div>
      <div className="grid gap-2 px-4 pt-5"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
    </main>
  );
}
