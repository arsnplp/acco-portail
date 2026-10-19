import { CardsSkeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-6 pb-nav"><CardsSkeleton n={4} /></main>;
}
