import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const CONTINENTS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"] as const;
export type ContinentChoice = (typeof CONTINENTS)[number];

const STORAGE_KEY = "orbita.continentPref";

export function loadContinentPref(): ContinentChoice {
  if (typeof window === "undefined") return "All";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return (CONTINENTS as readonly string[]).includes(v ?? "")
    ? (v as ContinentChoice)
    : "All";
}

export function saveContinentPref(v: ContinentChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, v);
}

export function useContinentPref(): [ContinentChoice, (v: ContinentChoice) => void] {
  const [v, setV] = useState<ContinentChoice>(() => loadContinentPref());
  return [v, setV];
}

export interface RegionSelectProps {
  value?: ContinentChoice;
  isSpainActive?: boolean;
  spainSkill?: "locate" | "flags" | "capitals" | "name";
  onChangeContinent?: (c: ContinentChoice) => void;
  className?: string;
}

/**
 * Unified Region Bar: Continents list + slightly separated Spain toggle.
 * Keeps navigation consistent across all modes (Locate, Flags, Capitals, Spain).
 */
export function RegionSelect({
  value,
  isSpainActive = false,
  spainSkill = "locate",
  onChangeContinent,
  className,
}: RegionSelectProps) {
  const navigate = useNavigate();

  const handleContinentClick = (c: ContinentChoice) => {
    saveContinentPref(c);
    if (isSpainActive) {
      const targetRoute =
        spainSkill === "flags"
          ? "/flags"
          : spainSkill === "capitals"
            ? "/capitals"
            : "/locate";
      void navigate({ to: targetRoute });
    } else if (onChangeContinent) {
      onChangeContinent(c);
    }
  };

  const spainLabel = spainSkill === "flags" ? "Spain (CCAA)" : "Spain";

  return (
    <div className={cn("flex items-center gap-2 flex-nowrap", className)}>
      {/* Continents pill bar */}
      <div
        className="glass rounded-full p-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto scrollbar-none whitespace-nowrap w-fit max-w-full"
        role="tablist"
        aria-label="Filter by continent"
      >
        {CONTINENTS.map((c) => {
          const isSelected = !isSpainActive && value === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleContinentClick(c)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer select-none",
                isSelected
                  ? "bg-white/15 text-white font-medium shadow-sm"
                  : "text-white/55 hover:text-white hover:bg-white/[0.07]",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Slightly separated Spain toggle */}
      {isSpainActive ? (
        <span
          className="glass rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider bg-white/20 text-white border-white/25 shadow-[0_0_12px_rgba(255,255,255,0.12)] flex items-center gap-1.5 shrink-0 select-none font-medium"
          title="Currently exploring Spain"
        >
          <span>🇪🇸</span> {spainLabel}
        </span>
      ) : (
        <Link
          to="/spain"
          search={{ skill: spainSkill === "name" ? "locate" : spainSkill }}
          className="glass rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/15 hover:border-white/25 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm active:scale-95"
          title={`Master Spain's ${spainSkill === "flags" ? "autonomous community flags" : spainSkill === "capitals" ? "capitals" : "geography"}`}
        >
          <span>🇪🇸</span> {spainLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * Legacy/Standalone Continent filter
 */
export function ContinentSelect({
  value,
  onChange,
  className,
}: {
  value: ContinentChoice;
  onChange: (v: ContinentChoice) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass rounded-full p-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto",
        "scrollbar-none whitespace-nowrap w-fit max-w-full",
        className,
      )}
      role="tablist"
      aria-label="Filter by continent"
    >
      {CONTINENTS.map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={value === c}
          onClick={() => {
            saveContinentPref(c);
            onChange(c);
          }}
          className={cn(
            "shrink-0 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors",
            value === c
              ? "bg-white/15 text-white"
              : "text-white/55 hover:text-white",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

