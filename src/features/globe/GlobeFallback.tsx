/**
 * Placeholder while the 3D globe loads: a quiet sphere at the globe's size,
 * so the page never sits blank and nothing jumps when the globe arrives.
 */
export function GlobeFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none" role="status">
      <div className="relative size-[min(68vmin,520px)] rounded-full border border-white/[0.07] bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--violet)_28%,transparent),transparent_65%)] shadow-[0_0_80px_-20px_color-mix(in_oklab,var(--violet)_45%,transparent)] motion-safe:animate-pulse">
        {/* One faint meridian and equator: reads as a globe, not a spinner. */}
        <div className="absolute inset-[18%_0] rounded-[50%] border border-white/[0.05]" />
        <div className="absolute inset-[0_32%] rounded-[50%] border border-white/[0.05]" />
      </div>
      <span className="sr-only">Loading globe</span>
    </div>
  );
}
