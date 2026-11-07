/** Skeleton of a question (prompt pill and answer field) while a session is being built. */
export function SessionLoading() {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 px-4" role="status">
      <div className="h-9 w-64 rounded-full bg-white/[0.06] border border-white/[0.06] motion-safe:animate-pulse" />
      <div className="h-[60px] w-full rounded-2xl bg-white/[0.04] border border-white/[0.06] motion-safe:animate-pulse" />
      <span className="sr-only">Loading question</span>
    </div>
  );
}
