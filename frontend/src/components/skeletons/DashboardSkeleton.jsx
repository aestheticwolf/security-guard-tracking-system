import SkeletonBlock from "./SkeletonBlock";

export default function DashboardSkeleton({ cardCount = 4 }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5"
          >
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-4 h-10 w-24" />
            <SkeletonBlock className="mt-3 h-3 w-32" />
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="glass-panel rounded-[28px] border border-white/10 p-5 shadow-glow">
            <SkeletonBlock className="h-5 w-56" />
            <SkeletonBlock className="mt-3 h-3 w-72" />
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <SkeletonBlock className="h-64 w-full" />
              <SkeletonBlock className="h-64 w-full" />
            </div>
          </div>
          <div className="glass-panel rounded-[28px] border border-white/10 p-5 shadow-glow">
            <SkeletonBlock className="h-5 w-44" />
            <div className="mt-5 grid gap-3">
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-panel rounded-[28px] border border-white/10 p-5 shadow-glow">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="mt-5 h-48 w-full" />
          </div>
          <div className="glass-panel rounded-[28px] border border-white/10 p-5 shadow-glow">
            <SkeletonBlock className="h-5 w-48" />
            <div className="mt-5 space-y-3">
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
