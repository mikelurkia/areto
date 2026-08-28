import {
  PageHeaderSkeleton,
  SectionPlaceholderSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      {/* La pantalla es, de momento, un "próximamente" a toda página. */}
      <SectionPlaceholderSkeleton action />
    </div>
  );
}
