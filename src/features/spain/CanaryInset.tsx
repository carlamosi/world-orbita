import { useMemo } from "react";
import type { SpainFeature } from "@/lib/spain/geo";

/** Canarias as one community, or its two provinces. */
export const CANARY_IDS = new Set(["ES-CN", "ES-GC", "ES-TF"]);

const WIDTH = 200;

/** Equirectangular paths for the features, scaled into a WIDTH-wide box (cos(lat) keeps the shapes true). */
export function projectCanaries(features: SpainFeature[]) {
  const rings = (f: SpainFeature) =>
    f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features) {
    for (const ring of rings(f)) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng!); maxLng = Math.max(maxLng, lng!);
        minLat = Math.min(minLat, lat!); maxLat = Math.max(maxLat, lat!);
      }
    }
  }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = WIDTH / ((maxLng - minLng) * k || 1);
  const height = (maxLat - minLat) * scale;
  const paths = features.map((f) => ({
    feature: f,
    d: rings(f)
      .map(
        (ring) =>
          "M" +
          ring
            .map(([lng, lat]) => `${(((lng! - minLng) * k) * scale).toFixed(1)},${((maxLat - lat!) * scale).toFixed(1)}`)
            .join("L") +
          "Z",
      )
      .join(""),
  }));
  return { paths, height };
}

interface Props {
  /** The active overlay features; only the Canary ones are drawn. */
  features: SpainFeature[];
  /** Same fill rule as the globe overlay, so state colours match. */
  fill: (d: object) => string;
  onClick?: (d: object) => void;
  onHover?: (d: object | null) => void;
}

/**
 * Canary Islands in a corner box, as Spanish maps draw them: they sit far
 * off the Spain view, so they stay visible and clickable without moving it.
 */
export function CanaryInset({ features, fill, onClick, onHover }: Props) {
  const canaries = useMemo(
    () => features.filter((f) => CANARY_IDS.has(f.properties?.id ?? "")),
    [features],
  );
  const { paths, height } = useMemo(() => projectCanaries(canaries), [canaries]);
  if (canaries.length === 0) return null;

  const pad = 10;
  return (
    <div className="glass rounded-xl border border-white/10 p-1.5 md:p-2 w-[118px] md:w-[180px] pointer-events-auto">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 px-1 pb-1">Canarias</div>
      <svg
        viewBox={`${-pad} ${-pad} ${WIDTH + pad * 2} ${height + pad * 2}`}
        className="w-full h-auto"
        role="group"
        aria-label="Canary Islands"
      >
        {paths.map(({ feature, d }) => {
          const name = feature.properties?.name ?? "";
          return (
            <path
              key={feature.properties?.id}
              d={d}
              fill={fill(feature)}
              stroke="rgba(255,255,255,0.75)"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
              className={onClick ? "cursor-pointer outline-none focus-visible:stroke-[color:var(--cyan)]" : undefined}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              aria-label={onClick ? name : undefined}
              onClick={onClick ? () => onClick(feature) : undefined}
              onKeyDown={
                onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onClick(feature);
                      }
                    }
                  : undefined
              }
              onMouseEnter={onHover ? () => onHover(feature) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
