import { CardsSkeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8"><CardsSkeleton n={4} /></main>;
}
