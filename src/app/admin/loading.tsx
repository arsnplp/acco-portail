import { CardsSkeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"><CardsSkeleton n={4} /></main>;
}
