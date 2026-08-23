import { cn } from "@/lib/utils";

export type SessionLengthMode = "quick" | "complete";

interface SessionLengthSelectProps {
  value: SessionLengthMode;
  onChange: (mode: SessionLengthMode) => void;
  continentCount: number;
  continent?: string | null;
  className?: string;
}

export function SessionLengthSelect({
  value,
  onChange,
  continentCount,
  continent,
  className,
}: SessionLengthSelectProps) {
  return (
    <div
      className={cn(
        "glass rounded-full p-1 flex flex-nowrap items-center gap-0.5 pointer-events-auto",
        className,
      )}
      role="group"
      aria-label="Session length"
    >
      <button
        type="button"
        onClick={() => onChange("quick")}
        aria-pressed={value === "quick"}
        className={cn(
          "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
          value === "quick"
            ? "bg-white/15 text-white"
            : "text-white/55 hover:text-white",
        )}
      >
        10 Q
      </button>
      <button
        type="button"
        onClick={() => onChange("complete")}
        aria-pressed={value === "complete"}
        title={`All ${continentCount} in ${!continent || continent === "All" ? "all regions" : continent}`}
        className={cn(
          "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
          value === "complete"
            ? "bg-white/15 text-white"
            : "text-white/55 hover:text-white",
        )}
      >
        All {continentCount}
      </button>
    </div>
  );
}
