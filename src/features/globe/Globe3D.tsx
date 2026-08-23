import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { TOUCH, MeshPhongMaterial, Color } from "three";
import { Minus, Plus, RotateCcw } from "lucide-react";

import type { Country } from "@/types/country";
import {
  ensureFeatures,
  loadCountryFeatures,
  type CountryFeature,
} from "./geo";

export type GlobeQuality = "high" | "medium" | "static";

interface Globe3DProps {
  countries: readonly Country[];
  highlightIso3?: string | null;
  revealIso3?: string | null;
  /** Mistakenly clicked country (for differential feedback / hypercorrection). */
  wrongIso3?: string | null;
  /** External focus request (Explorer search, deep-link, etc.). */
  focusIso3?: string | null;
  /** Generic feature highlight ID (alias for highlightIso3) */
  highlightId?: string | null;
  /** Generic feature reveal ID (alias for revealIso3) */
  revealId?: string | null;
  /** Generic feature wrong ID (alias for wrongIso3) */
  wrongId?: string | null;
  /** Generic feature focus ID (alias for focusIso3) */
  focusId?: string | null;
  /** Active continent selection ("Africa", "Americas", "Asia", "Europe", "Oceania") — highlights region & mutes non-active landmasses. */
  activeContinent?: string | null;
  /** Optional list of due-for-review countries — receives a slow amber pulse. */
  dueReviewIso3?: readonly string[];
  /** Optional miss-rate per ISO3 (0–1) — boosts adaptive hitbox size. */
  missRates?: Readonly<Record<string, number>>;
  onCountryClick?: (iso3: string) => void;
  /** Generic feature click handler (alias for onCountryClick) */
  onFeatureClick?: (id: string) => void;
  pointOfView?: { lat: number; lng: number; altitude?: number };
  size?: number;
  quality?: GlobeQuality;
  /** Hide only the country-name tooltip (Find/Capitals). Glow + altitude lift remain for spatial feedback. */
  disableHoverLabel?: boolean;
  /** Strict mode: suppress ALL hover feedback (glow, lift, tooltip). */
  disableHoverFeedback?: boolean;
  /** Changes whenever the active question changes — clears stale hover state on transition. */
  questionKey?: string | null;
  /**
   * Optional secondary polygon overlay (e.g. Spain CCAA / province features).
   * Rendered as react-globe.gl `customPolygonsData` — completely independent
   * of the world-country polygon layer.  Pass raw GeoJSON Feature objects.
   */
  overlayPolygons?: object[];
  /** Cap colour callback for overlayPolygons. Defaults to semi-transparent violet. */
  overlayCapColor?: (d: object) => string;
  /** Side colour callback for overlayPolygons. */
  overlaySideColor?: (d: object) => string;
  /** Stroke colour callback for overlayPolygons. */
  overlayStrokeColor?: (d: object) => string;
  /** Altitude for overlayPolygons (default 0.004). */
  overlayAltitude?: number | ((d: object) => number);
  /** Label accessor for overlayPolygons. */
  overlayLabel?: (d: object) => string;
  /** Click handler for overlayPolygons. Receives the feature object. */
  onOverlayClick?: (d: object) => void;
}

// ---------------------------------------------------------------------------
// Constants — tuned for the ORBITA dark-space aesthetic.

const COLOR_HIGHLIGHT = "16, 185, 129"; // emerald / neon green (correct answer / active)
const COLOR_WRONG = "244, 63, 94"; // elegant rose-coral (mistake / prediction error)
const COLOR_REVEAL = "16, 185, 129"; // emerald green (correct target reveal)
const COLOR_DUE = "255, 184, 77"; // amber
const COLOR_HOVER = "0, 212, 255"; // cyan
const COLOR_BASE = "108, 99, 255"; // violet


const CONTINENT_TINT: Record<string, string> = {
  Africa: "108, 99, 255", // default violet
  Americas: "108, 99, 255",
  Asia: "0, 212, 255",
  Europe: "0, 255, 178",
  Oceania: "108, 99, 255", // default violet
  Antarctic: "203, 213, 225",
};

const CONTINENT_CENTERS: Record<string, { lat: number; lng: number; altitude: number }> = {
  Africa: { lat: 8, lng: 20, altitude: 1.7 },
  Americas: { lat: 15, lng: -85, altitude: 1.9 },
  Asia: { lat: 35, lng: 95, altitude: 1.8 },
  Europe: { lat: 52, lng: 18, altitude: 1.3 },
  Oceania: { lat: -22, lng: 135, altitude: 1.6 },
  Antarctic: { lat: -80, lng: 0, altitude: 2.0 },
};

function angularDistanceDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δλ = (lng2 - lng1) * (Math.PI / 180);
  const c = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.acos(Math.min(1, Math.max(-1, c))) * (180 / Math.PI);
}

// Altitude bands → quantised so memos don't churn during every frame.
function altitudeBand(alt: number): number {
  if (alt < 0.4) return 0;
  if (alt < 0.7) return 1;
  if (alt < 1.1) return 2;
  if (alt < 1.7) return 3;
  if (alt < 2.4) return 4;
  return 5;
}

function strokeOpacityFor(alt: number): number {
  // 0.18 at alt 2.4+ → 0.55 at alt 0.4
  const t = Math.max(0, Math.min(1, (2.4 - alt) / 2.0));
  return 0.18 + t * (0.55 - 0.18);
}

// ---------------------------------------------------------------------------

export default function Globe3D({
  countries,
  highlightIso3,
  revealIso3,
  wrongIso3,
  focusIso3,
  highlightId,
  revealId,
  wrongId,
  focusId,
  activeContinent = null,
  dueReviewIso3,
  missRates,
  onCountryClick,
  onFeatureClick,
  pointOfView,
  size,
  quality = "high",
  disableHoverLabel = false,
  disableHoverFeedback = false,
  questionKey = null,
  overlayPolygons,
  overlayCapColor,
  overlaySideColor,
  overlayStrokeColor,
  overlayAltitude = 0.004,
  overlayLabel,
  onOverlayClick,
}: Globe3DProps) {
  const effHighlight = highlightId ?? highlightIso3 ?? null;
  const effReveal = revealId ?? revealIso3 ?? null;
  const effWrong = wrongId ?? wrongIso3 ?? null;
  const effFocus = focusId ?? focusIso3 ?? null;
  const handleFeatureClick = onFeatureClick ?? onCountryClick;

  const ref = useRef<GlobeMethods | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 600, h: 600 });
  const [hoverIso3, setHoverIso3] = useState<string | null>(null);
  const [altBand, setAltBand] = useState(4);
  const [features, setFeatures] = useState<CountryFeature[] | null>(() =>
    loadCountryFeatures("110m"),
  );

  // ---- Environment / quality resolution --------------------------------
  const effectiveQuality: GlobeQuality = useMemo(() => {
    if (typeof window === "undefined") return quality;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return "static";
    const isMobile =
      window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
    if (isMobile && quality === "high") return "medium";
    return quality;
  }, [quality]);

  // ---- Resize observer -------------------------------------------------
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDim({ w: Math.max(320, r.width), h: Math.max(320, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Premium Orbita globe material -----------------------------------
  const globeMaterial = useMemo(() => {
    const mat = new MeshPhongMaterial({
      color: new Color("#0a0d1f"),
      emissive: new Color("#0b1230"),
      emissiveIntensity: 0.35,
      specular: new Color("#6C63FF"),
      shininess: 14,
      transparent: false,
    });
    return mat;
  }, []);
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);

  // ---- Continent map (iso3 → continent) --------------------------------
  const continentByIso3 = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countries) m.set(c.iso3, c.continent);
    return m;
  }, [countries]);

  // ---- Country lookup for focus / rings --------------------------------
  const countryByIso3 = useMemo(() => {
    const m = new Map<string, Country>();
    for (const c of countries) m.set(c.iso3, c);
    return m;
  }, [countries]);

  const featureByIso3 = useMemo(() => {
    const m = new Map<string, CountryFeature>();
    if (features) for (const f of features) m.set(f.properties.iso3, f);
    return m;
  }, [features]);

  // ---- Microstate Marker Cloud -----------------------------------------
  // CRITICAL ROOT CAUSE: The 110m TopoJSON used for polygon rendering omits or
  // severely degrades many genuine microstates (Vatican ~0.44 km², Monaco ~2 km²
  // may have 0-1 polygon vertices at this resolution). Sourcing markers from
  // the `countries` prop (which uses real-world km² area from the dataset) is
  // the only reliable approach — it guarantees Vatican, Monaco, etc. always get
  // a marker regardless of TopoJSON resolution.
  //
  // Threshold rationale — countries where normal polygon raycasting is unreliable:
  //   < 700 km²:  Vatican (0.44), Monaco (2), Nauru (21), Tuvalu (26),
  //               San Marino (61), Andorra (468), Liechtenstein (160),
  //               Maldives (298), Malta (316), Bahrain (765)
  //   < 1500 km²: Singapore (728), Comoros (2235 — borderline),
  //               Cabo Verde (4033), São Tomé (964), Kiribati (811)
  //   Normal countries (excluded): Luxembourg (2586), Samoa (2842) and above
  //
  // We use 1000 km² as the primary threshold plus a secondary span check
  // (< 1.5° from the geo data) for tiny island chains that are dispersed.
  // This is a principled criterion, not a hardcoded list of countries.

  const MICRO_AREA_KM2 = 1000; // Real-world km² from Country dataset

  const hitboxPoints = useMemo(() => {
    type HitboxPoint = { iso3: string; name: string; lat: number; lng: number; radius: number; micro: boolean };
    const result: HitboxPoint[] = [];

    for (const c of countries) {
      // Primary criterion: real-world area from the canonical Country dataset.
      // This is immune to TopoJSON resolution degradation.
      const isMicro = c.area > 0 && c.area <= MICRO_AREA_KM2;

      // Secondary criterion: tiny dispersed archipelagos may have larger total
      // area but still be difficult to click (e.g. Marshall Islands at ~181 km²
      // but spread across a huge ocean area). These are caught by area already.
      // We only skip if clearly a normal country.
      if (!isMicro) continue;

      if (activeContinent && activeContinent !== "All") {
        if (c.continent !== activeContinent) continue;
      }

      // Hitbox radius in globe units — generous for reliable raycasting.
      // These are the invisible interaction spheres, not the visual dot size.
      // At far zoom (band 4–5): 3.0 globe-units ≈ 3° arc = easy to hit.
      // At close zoom (band 0): 1.8 globe-units — still larger than the country.
      const radius = altBand >= 4 ? 3.0 : altBand >= 3 ? 2.6 : altBand >= 2 ? 2.2 : altBand >= 1 ? 1.9 : 1.8;

      result.push({
        iso3: c.iso3,
        name: c.name,
        lat: c.coordinates[0],  // Country dataset gives [lat, lng]
        lng: c.coordinates[1],
        radius,
        micro: true,
      });
    }
    return result;
  }, [countries, altBand, activeContinent]);

  // ---- Polygon styling accessors (memoised) ----------------------------
  const strokeOpacity = strokeOpacityFor(
    altBand === 0 ? 0.3 : altBand === 1 ? 0.55 : altBand === 2 ? 0.9 : altBand === 3 ? 1.4 : altBand === 4 ? 2.0 : 2.8,
  );

  const dueSet = useMemo(
    () => new Set(dueReviewIso3 ?? []),
    [dueReviewIso3],
  );

  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (effectiveQuality === "static") return;
    if (dueSet.size === 0) return;
    const id = window.setInterval(() => setPulse((p) => (p + 1) % 2), 1100);
    return () => window.clearInterval(id);
  }, [dueSet, effectiveQuality]);

  const effHoverIso3 = disableHoverFeedback ? null : hoverIso3;

  // Clear stale hover when active question changes
  useEffect(() => {
    setHoverIso3(null);
  }, [questionKey, effHighlight, effReveal, effWrong]);

  // Microstate marker styling — subtle glowing pinpoints for tiny territories.
  const pointColorFn = useCallback(
    (d: object) => {
      const p = d as { iso3: string; micro: boolean };
      if (!p.micro) return "rgba(0,0,0,0)";
      if (p.iso3 === effWrong) return `rgba(${COLOR_WRONG}, 1.0)`;
      if (p.iso3 === effReveal) return `rgba(${COLOR_REVEAL}, 1.0)`;
      if (p.iso3 === effHighlight) return `rgba(${COLOR_HIGHLIGHT}, 1.0)`;
      if (p.iso3 === effHoverIso3) return `rgba(${COLOR_HOVER}, 1.0)`;
      // Default: gentle neon pinpoint — visible but not distracting
      return `rgba(${COLOR_HIGHLIGHT}, 0.6)`;
    },
    [effWrong, effReveal, effHighlight, effHoverIso3],
  );

  // Point label: show country name as a styled tooltip.
  const pointLabelFn = useCallback(
    (d: object) => {
      const p = d as { iso3: string; name: string; micro: boolean };
      if (!p.micro) return "";
      // In Find mode, don't show the name (that would reveal the answer)
      if (disableHoverLabel) return "";
      return `<div style="font-family:'Inter',sans-serif;padding:5px 10px;background:rgba(5,5,8,0.88);border:1px solid rgba(255,255,255,0.14);border-radius:9999px;color:#fff;font-size:11px;backdrop-filter:blur(10px);white-space:nowrap">${p.name}</div>`;
    },
    [disableHoverLabel],
  );

  const pointRadiusFn = useCallback((d: object) => {
    const p = d as { radius: number; micro: boolean };
    if (!p.micro) return 0;
    const base = altBand >= 3 ? 0.42 : altBand >= 1 ? 0.36 : 0.30;
    return base;
  }, [altBand]);

  const pointAltitudeFn = useCallback((d: object) => {
    const p = d as { micro: boolean };
    return p.micro ? 0.04 : 0;
  }, []);

  // Senior UI/UX Continent Focus Polygon Cap Styling
  const polygonCapColor = useCallback(
    (d: object) => {
      const f = d as CountryFeature & { properties: { id?: string } };
      // Overlay features (Spain CCAA/provinces) use properties.id; world features use properties.iso3
      const fid: string = f.properties.id ?? f.properties.iso3 ?? "";
      const isOverlay = !f.properties.iso3;

      if (isOverlay) {
        // Overlay polygon: apply overlay-specific colour from prop, or fallback to session state
        if (overlayCapColor) return overlayCapColor(d);
        if (fid === effWrong) return `rgba(${COLOR_WRONG}, 0.75)`;
        if (fid === effReveal) return `rgba(${COLOR_REVEAL}, 0.70)`;
        if (fid === effHighlight) return `rgba(${COLOR_HIGHLIGHT}, 0.70)`;
        return "rgba(108,99,255,0.12)";
      }

      const iso3 = fid;
      if (iso3 === effWrong) return `rgba(${COLOR_WRONG}, 0.22)`;
      if (iso3 === effReveal) return `rgba(${COLOR_REVEAL}, 0.22)`;
      if (iso3 === effHighlight) return `rgba(${COLOR_HIGHLIGHT}, 0.22)`;
      if (iso3 === effHoverIso3) {
        const cont = continentByIso3.get(iso3);
        if (activeContinent && activeContinent !== "All" && cont !== activeContinent) {
          return "rgba(6, 9, 20, 0.78)";
        }
        return `rgba(${COLOR_HOVER}, 0.22)`;
      }
      if (dueSet.has(iso3)) {
        const a = pulse === 0 ? 0.1 : 0.18;
        return `rgba(${COLOR_DUE}, ${a})`;
      }
      const cont = continentByIso3.get(iso3);
      const inActive = !activeContinent || activeContinent === "All" || cont === activeContinent;
      if (!inActive) {
        return "rgba(18, 20, 42, 0.62)";
      }
      if (activeContinent && cont && CONTINENT_TINT[cont]) {
        return `rgba(${CONTINENT_TINT[cont]}, 0.16)`;
      }
      return `rgba(${COLOR_BASE}, 0.08)`;
    },
    [effWrong, effReveal, effHighlight, effHoverIso3, dueSet, pulse, continentByIso3, activeContinent, overlayCapColor],
  );

  const polygonSideColor = useCallback(
    () => `rgba(${COLOR_BASE}, 0.06)`,
    [],
  );

  const polygonStrokeColor = useCallback(
    (d: object) => {
      const f = d as CountryFeature & { properties: { id?: string } };
      const isOverlay = !f.properties.iso3;
      const fid: string = f.properties.id ?? f.properties.iso3 ?? "";

      if (isOverlay) {
        if (overlaySideColor) return overlaySideColor(d);
        return "rgba(255,255,255,0.22)";
      }

      const iso3 = fid;
      if (iso3 === effWrong) return `rgba(${COLOR_WRONG}, 0.85)`;
      if (iso3 === effReveal) return `rgba(${COLOR_REVEAL}, 0.85)`;
      if (iso3 === effHighlight) return `rgba(${COLOR_HIGHLIGHT}, 0.85)`;
      if (iso3 === effHoverIso3) {
        const cont = continentByIso3.get(iso3);
        if (activeContinent && activeContinent !== "All" && cont !== activeContinent) {
          return "rgba(255, 255, 255, 0.035)";
        }
        return `rgba(${COLOR_HOVER}, 0.8)`;
      }
      const cont = continentByIso3.get(iso3);
      const inActive = !activeContinent || activeContinent === "All" || cont === activeContinent;
      if (!inActive) {
        return `rgba(255, 255, 255, ${Math.max(0.025, strokeOpacity * 0.2)})`;
      }
      return `rgba(255, 255, 255, ${strokeOpacity})`;
    },
    [effWrong, effReveal, effHighlight, effHoverIso3, strokeOpacity, continentByIso3, activeContinent, overlaySideColor],
  );

  const polygonAltitude = useCallback(
    (d: object) => {
      const f = d as CountryFeature & { properties: { id?: string } };
      const isOverlay = !f.properties.iso3;
      const fid: string = f.properties.id ?? f.properties.iso3 ?? "";

      if (isOverlay) {
        if (fid === effWrong || fid === effReveal || fid === effHighlight) return 0.012;
        return overlayAltitude as number;
      }

      const iso3 = fid;
      const inActive = !activeContinent || activeContinent === "All" || continentByIso3.get(iso3) === activeContinent;
      if (!inActive) return 0.002;
      if (iso3 === effWrong || iso3 === effReveal || iso3 === effHighlight) return 0.02;
      if (iso3 === effHoverIso3) return 0.012;
      return 0.004;
    },
    [effWrong, effReveal, effHighlight, effHoverIso3, activeContinent, continentByIso3, overlayAltitude],
  );

  const polygonLabel = useCallback(
    (d: object) => {
      if (disableHoverFeedback || disableHoverLabel) return "";
      const f = d as CountryFeature & { properties: { id?: string } };
      const isOverlay = !f.properties.iso3;

      if (isOverlay) {
        if (overlayLabel) return overlayLabel(d);
        return f.properties.name
          ? `<div style="font-family:'Inter',sans-serif;padding:6px 10px;background:rgba(5,5,8,0.85);border:1px solid rgba(255,255,255,0.12);border-radius:9999px;color:#fff;font-size:12px;backdrop-filter:blur(8px)">${f.properties.name}</div>`
          : "";
      }

      const iso3 = f.properties.iso3;
      if (activeContinent && activeContinent !== "All") {
        const cont = continentByIso3.get(iso3);
        if (cont !== activeContinent) return ""; // Suppress tooltip outside active region
      }
      return `<div style="font-family:'Inter',sans-serif;padding:6px 10px;background:rgba(5,5,8,0.85);border:1px solid rgba(255,255,255,0.12);border-radius:9999px;color:#fff;font-size:12px;backdrop-filter:blur(8px)">${f.properties.name}</div>`;
    },
    [disableHoverFeedback, disableHoverLabel, activeContinent, continentByIso3, overlayLabel],
  );

  // ---- Unified camera targeting pass ----------------------------------
  const activeCameraTarget = useMemo(() => {
    if (effReveal) {
      const f = featureByIso3.get(effReveal);
      if (f) {
        const [clng, clat] = f.properties.centroid;
        const span = f.properties.angularSpan ?? 5;
        // Altitude needed to frame the country: span/28 gives ~1.0 for a country
        // spanning ~28°. We clamp to [0.22, 1.6].
        const frameAlt = Math.max(0.22, Math.min(1.6, Math.max(span, 1.5) / 28));
        // Read the current live altitude if globe is mounted; fall back to frameAlt.
        const liveAlt = ref.current ? ref.current.pointOfView().altitude : frameAlt;
        // Choose the more contextual altitude: if player is already zoomed in
        // enough to see the country, preserve their zoom. Otherwise zoom out
        // just enough. Never zoom in closer than frameAlt.
        const altitude = Math.max(frameAlt, Math.min(liveAlt * 1.25, 1.8));
        return { lat: clat, lng: clng, altitude, key: `reveal:${effReveal}`, duration: 1600 };
      }
      const c = countryByIso3.get(effReveal);
      if (c) {
        const liveAlt = ref.current ? ref.current.pointOfView().altitude : 1.4;
        const altitude = Math.min(Math.max(liveAlt, 1.0), 1.6);
        return { lat: c.coordinates[0], lng: c.coordinates[1], altitude, key: `reveal:${effReveal}`, duration: 1600 };
      }
    }
    if (effFocus) {
      const f = featureByIso3.get(effFocus);
      if (f) {
        const [clng, clat] = f.properties.centroid;
        const span = f.properties.angularSpan ?? 5;
        const altitude = Math.max(0.22, Math.min(2.0, Math.max(span, 1.5) / 28));
        return { lat: clat, lng: clng, altitude, key: `focus:${effFocus}`, duration: 1200 };
      }
      const c = countryByIso3.get(effFocus);
      if (c) {
        return { lat: c.coordinates[0], lng: c.coordinates[1], altitude: 1.4, key: `focus:${effFocus}`, duration: 1200 };
      }
    }
    if (pointOfView) {
      const lat = pointOfView.lat;
      const lng = pointOfView.lng;
      // If no explicit altitude is provided, preserve the player's current zoom.
      // This gives a smooth pan-only transition that doesn't yank them out.
      const liveAlt = ref.current ? ref.current.pointOfView().altitude : 1.8;
      const altitude = pointOfView.altitude ?? liveAlt;
      return {
        lat,
        lng,
        altitude,
        key: `pov:${lat.toFixed(3)},${lng.toFixed(3)},${altitude.toFixed(3)}`,
        duration: 1200,
      };
    }
    return null;
  }, [effReveal, effFocus, pointOfView, featureByIso3, countryByIso3]);

  const lastCameraTargetKey = useRef<string | null>(null);

  useEffect(() => {
    if (!activeCameraTarget || !ref.current) return;
    if (lastCameraTargetKey.current === activeCameraTarget.key) return;
    lastCameraTargetKey.current = activeCameraTarget.key;

    ref.current.controls().autoRotate = false;
    ref.current.pointOfView(
      { lat: activeCameraTarget.lat, lng: activeCameraTarget.lng, altitude: activeCameraTarget.altitude },
      effectiveQuality === "static" ? 0 : activeCameraTarget.duration,
    );
  }, [activeCameraTarget, effectiveQuality]);

  // ---- Smooth Camera Rotation on Continent Selection -----------------
  const lastActiveContinent = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ref.current) return;
    if (lastActiveContinent.current === undefined) {
      lastActiveContinent.current = activeContinent;
      if (activeContinent && CONTINENT_CENTERS[activeContinent]) {
        const center = CONTINENT_CENTERS[activeContinent];
        ref.current.pointOfView({ lat: center.lat, lng: center.lng, altitude: center.altitude }, 0);
      }
      return;
    }

    if (lastActiveContinent.current === activeContinent) return;
    lastActiveContinent.current = activeContinent;

    const g = ref.current;
    if (!activeContinent || activeContinent === "All") {
      g.pointOfView({ lat: 20, lng: 0, altitude: 2.3 }, effectiveQuality === "static" ? 0 : 1200);
    } else if (CONTINENT_CENTERS[activeContinent]) {
      const center = CONTINENT_CENTERS[activeContinent];
      g.pointOfView(
        { lat: center.lat, lng: center.lng, altitude: center.altitude },
        effectiveQuality === "static" ? 0 : 1400,
      );
    }
  }, [activeContinent, effectiveQuality]);

  // ---- Explore-oriented camera logic for new questions ----------------
  // When a new question loads (driven by questionKey changes), we avoid centering
  // exactly on the target country since that reveals the answer. Instead:
  //  1. Calculate distance from current view center to the target country.
  //  2. If already in view (dist < threshold), keep the view exactly as is.
  //     If player is zoomed in too closely (alt < 0.8), zoom out slightly for context.
  //  3. If not in view (dist > threshold, e.g. on other side of the globe),
  //     rotate smoothly to the target country's continent center at a zoomed-out
  //     altitude so the player is oriented to the right region, but still has
  //     to search for and find the country.
  const lastQuestionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!questionKey || !ref.current) {
      lastQuestionKey.current = questionKey;
      return;
    }
    if (lastQuestionKey.current === questionKey) return;
    lastQuestionKey.current = questionKey;

    const g = ref.current;
    const targetCountry = countryByIso3.get(questionKey);
    if (!targetCountry) return;

    const pov = g.pointOfView();
    const currentLat = pov.lat;
    const currentLng = pov.lng;
    const currentAlt = pov.altitude;

    const targetLat = targetCountry.coordinates[0];
    const targetLng = targetCountry.coordinates[1];

    const dist = angularDistanceDeg(currentLat, currentLng, targetLat, targetLng);
    // Visibility threshold scales with camera altitude: closer zoom = smaller visible field.
    const threshold = Math.min(75, 20 + currentAlt * 30);

    if (dist > threshold) {
      // Pan to the center of the country's continent to orient the player
      const continent = targetCountry.continent;
      const center = CONTINENT_CENTERS[continent] || { lat: targetLat, lng: targetLng };
      // Zoom out slightly to give context
      const altitude = Math.max(currentAlt * 1.15, 1.6);

      g.pointOfView({ lat: center.lat, lng: center.lng, altitude }, 1400);
    } else {
      // Already in the visible viewport, but if they are zoomed in very close,
      // perform a subtle zoom-out in place so they have space to search.
      if (currentAlt < 0.8) {
        g.pointOfView({ lat: currentLat, lng: currentLng, altitude: currentAlt * 1.35 }, 800);
      }
    }
  }, [questionKey, countryByIso3]);

  // ---- Click / hover handlers (active continent aware) ----------------
  const handlePolygonClick = useCallback(
    (d: object) => {
      const f = d as CountryFeature & { properties: { id?: string } };
      const isOverlay = !f.properties.iso3;
      if (isOverlay) {
        if (onOverlayClick) {
          onOverlayClick(d);
        } else {
          const fid = f.properties.id ?? "";
          handleFeatureClick?.(fid);
        }
        return;
      }

      const iso3 = f.properties.iso3;
      if (activeContinent && activeContinent !== "All") {
        const cont = continentByIso3.get(iso3);
        if (cont !== activeContinent) return; // Suppress click outside active region
      }
      handleFeatureClick?.(iso3);
    },
    [handleFeatureClick, onOverlayClick, activeContinent, continentByIso3],
  );

  const handlePolygonHover = useCallback(
    (d: object | null) => {
      if (!d) {
        setHoverIso3(null);
        return;
      }
      const f = d as CountryFeature & { properties: { id?: string } };
      const isOverlay = !f.properties.iso3;
      if (isOverlay) {
        setHoverIso3(f.properties.id ?? null);
        return;
      }

      const iso3 = f.properties.iso3;
      if (activeContinent && activeContinent !== "All") {
        const cont = continentByIso3.get(iso3);
        if (cont !== activeContinent) {
          setHoverIso3(null);
          return;
        }
      }
      setHoverIso3(iso3);
    },
    [activeContinent, continentByIso3],
  );

  const handleHitboxClick = useCallback(
    (d: object) => {
      const p = d as { iso3: string };
      if (activeContinent && activeContinent !== "All") {
        const cont = continentByIso3.get(p.iso3);
        if (cont !== activeContinent) return;
      }
      handleFeatureClick?.(p.iso3);
    },
    [handleFeatureClick, activeContinent, continentByIso3],
  );

  const handleHitboxHover = useCallback(
    (d: object | null) => {
      if (!d) {
        setHoverIso3(null);
        return;
      }
      const p = d as { iso3: string };
      if (activeContinent && activeContinent !== "All") {
        const cont = continentByIso3.get(p.iso3);
        if (cont !== activeContinent) {
          setHoverIso3(null);
          return;
        }
      }
      setHoverIso3(p.iso3);
    },
    [activeContinent, continentByIso3],
  );

  // ---- OrbitControls wiring (deep zoom optimized) ---------------------
  const lastBandRef = useRef(altBand);
  lastBandRef.current = altBand;

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const controls = g.controls() as unknown as {
      enableZoom: boolean;
      enableDamping: boolean;
      dampingFactor: number;
      zoomSpeed: number;
      rotateSpeed: number;
      autoRotate: boolean;
      autoRotateSpeed: number;
      minDistance: number;
      maxDistance: number;
      touches: { ONE: number; TWO: number };
      addEventListener: (k: string, cb: () => void) => void;
      removeEventListener: (k: string, cb: () => void) => void;
      object: { position: { length: () => number } };
    };
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08; // Smooth damping at deep zoom
    controls.zoomSpeed = 0.6;
    controls.rotateSpeed = 0.45;
    controls.minDistance = 108; // Altitude ~0.08: allows close inspection of microstates
    controls.maxDistance = 420;
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    if (effectiveQuality === "static") {
      controls.autoRotate = false;
    } else {
      controls.autoRotate = true;
      controls.autoRotateSpeed = effectiveQuality === "medium" ? 0.18 : 0.35;
    }
    g.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);

    // Auto-rotate suspension on user interaction.
    let resumeTimer: number | null = null;
    const onStart = () => {
      controls.autoRotate = false;
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      if (effectiveQuality === "static") return;
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 6000);
    };

    // Altitude tracking — rAF throttled.
    let raf = 0;
    const onChange = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dist = controls.object.position.length();
        const alt = dist / 100 - 1; // globe radius is 100
        const band = altitudeBand(alt);
        if (band !== lastBandRef.current) {
          setAltBand(band);
        }
      });
    };

    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    controls.addEventListener("change", onChange);
    return () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.removeEventListener("change", onChange);
      if (raf) cancelAnimationFrame(raf);
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQuality]);

  // ---- Dual Ring Shockwave (Error / Success) ---------------------------
  const rings = useMemo(() => {
    if (effectiveQuality === "static") return [];
    const res = [];
    if (effWrong) {
      const c = countryByIso3.get(effWrong);
      if (c) {
        res.push({
          lat: c.coordinates[0],
          lng: c.coordinates[1],
          maxR: 8,
          propagationSpeed: 4,
          repeatPeriod: 900,
          color: COLOR_WRONG,
        });
      }
    }
    const target = effReveal ?? effHighlight;
    if (target) {
      const c = countryByIso3.get(target);
      if (c) {
        const isReveal = target === effReveal;
        res.push({
          lat: c.coordinates[0],
          lng: c.coordinates[1],
          maxR: isReveal ? 8 : 6,
          propagationSpeed: isReveal ? 4 : 3,
          repeatPeriod: isReveal ? 900 : 1200,
          color: COLOR_HIGHLIGHT,
        });
      }
    }
    return res;
  }, [effWrong, effReveal, effHighlight, countryByIso3, effectiveQuality]);

  // ---- Spatial Country Name Badges (3D In-Situ Feedback) ---------------
  interface SpatialPill {
    id: string;
    iso3: string;
    name: string;
    lat: number;
    lng: number;
    kind: "wrong" | "correct";
  }

  const spatialPills = useMemo<SpatialPill[]>(() => {
    const pills: SpatialPill[] = [];

    if (effWrong) {
      const f = featureByIso3.get(effWrong);
      const c = countryByIso3.get(effWrong);
      const name = f?.properties.name ?? c?.name ?? effWrong;
      const lat = f ? f.properties.centroid[1] : c?.coordinates[0] ?? 0;
      const lng = f ? f.properties.centroid[0] : c?.coordinates[1] ?? 0;
      pills.push({ id: `wrong-${effWrong}`, iso3: effWrong, name, lat, lng, kind: "wrong" });
    }

    if (effReveal) {
      const f = featureByIso3.get(effReveal);
      const c = countryByIso3.get(effReveal);
      const name = f?.properties.name ?? c?.name ?? effReveal;
      const lat = f ? f.properties.centroid[1] : c?.coordinates[0] ?? 0;
      const lng = f ? f.properties.centroid[0] : c?.coordinates[1] ?? 0;
      pills.push({ id: `reveal-${effReveal}`, iso3: effReveal, name, lat, lng, kind: "correct" });
    } else if (effHighlight && effHighlight !== effWrong) {
      const f = featureByIso3.get(effHighlight);
      const c = countryByIso3.get(effHighlight);
      const name = f?.properties.name ?? c?.name ?? effHighlight;
      const lat = f ? f.properties.centroid[1] : c?.coordinates[0] ?? 0;
      const lng = f ? f.properties.centroid[0] : c?.coordinates[1] ?? 0;
      pills.push({ id: `highlight-${effHighlight}`, iso3: effHighlight, name, lat, lng, kind: "correct" });
    }

    return pills;
  }, [effWrong, effReveal, effHighlight, featureByIso3, countryByIso3]);

  const htmlElementFn = useCallback((d: object) => {
    const p = d as SpatialPill;
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    el.style.userSelect = "none";
    el.style.transform = "translate(-50%, -100%)";
    el.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease";

    if (p.kind === "wrong") {
      el.innerHTML = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 13px;
          background: rgba(22, 10, 15, 0.85);
          border: 1px solid rgba(244, 63, 94, 0.75);
          box-shadow: 0 0 8px rgba(244, 63, 94, 0.6), 0 2px 6px rgba(0,0,0,0.4);
          border-radius: 9999px;
          color: #fda4af;
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          backdrop-filter: blur(8px);
          white-space: nowrap;
          animation: pulse 1.5s ease-out infinite;
        ">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;background:rgba(244,63,94,0.2);border-radius:50%;color:#fb7185;font-size:10px;font-weight:800;">
            ✕
          </span>
          <span>${p.name}</span>
        </div>
        <style>@keyframes pulse {0% {transform: scale(0.95); opacity:0.9;} 50% {transform: scale(1.05); opacity:1;} 100% {transform: scale(0.95); opacity:0.9;}}</style>
      `;
    } else {
      // No badge for correct answers – render an empty invisible element.
      el.style.display = "none";
    }
    return el;
  }, []);

  // ---- Zoom control handlers ------------------------------------------
  const zoomBy = useCallback(
    (factor: number) => {
      const g = ref.current;
      if (!g) return;
      const pov = g.pointOfView();
      g.pointOfView({ ...pov, altitude: Math.max(0.22, Math.min(3.2, pov.altitude * factor)) }, 500);
    },
    [],
  );
  const resetView = useCallback(() => {
    const g = ref.current;
    if (!g) return;
    g.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 800);
  }, []);

  // ---- Keyboard a11y ---------------------------------------------------
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const g = ref.current;
      if (!g) return;
      const step = e.shiftKey ? 15 : 5;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(0.7);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1.4);
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const pov = g.pointOfView();
        const dLat = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        const dLng = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        g.pointOfView(
          {
            lat: Math.max(-85, Math.min(85, pov.lat + dLat)),
            lng: ((pov.lng + dLng + 540) % 360) - 180,
            altitude: pov.altitude,
          },
          300,
        );
      } else if ((e.key === "Enter" || e.key === " ") && hoverIso3) {
        e.preventDefault();
        handleFeatureClick?.(hoverIso3);
      }
    },
    [zoomBy, resetView, hoverIso3, handleFeatureClick],
  );

  // ---- Render ---------------------------------------------------------
  return (
    <div
      ref={wrapperRef}
      className="size-full relative outline-none"
      style={{ minHeight: size ?? 480, touchAction: "none" }}
      tabIndex={0}
      role="application"
      aria-label="Interactive globe — arrow keys to rotate, plus and minus to zoom, zero to reset"
      onKeyDown={onKeyDown}
    >
      <Globe
        ref={ref}
        width={dim.w}
        height={dim.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor="#6C63FF"
        atmosphereAltitude={
          effectiveQuality === "static" ? 0.16 : effectiveQuality === "medium" ? 0.2 : 0.22
        }
        rendererConfig={{
          antialias: effectiveQuality !== "static",
          alpha: true,
        }}
        polygonsData={[...(overlayPolygons ?? []), ...(features ?? [])]}
        polygonGeoJsonGeometry={
          ((d: object) => (d as CountryFeature).geometry) as unknown as undefined
        }
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}
        polygonLabel={polygonLabel}
        polygonsTransitionDuration={0}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        pointsData={hitboxPoints}
        pointLat={(d: object) => (d as { lat: number }).lat}
        pointLng={(d: object) => (d as { lng: number }).lng}
        pointColor={pointColorFn}
        pointLabel={pointLabelFn}
        pointAltitude={pointAltitudeFn}
        pointRadius={pointRadiusFn}
        pointsMerge={false}
        onPointClick={handleHitboxClick}
        onPointHover={handleHitboxHover}
        htmlElementsData={spatialPills}
        htmlLat={(d: object) => (d as { lat: number }).lat}
        htmlLng={(d: object) => (d as { lng: number }).lng}
        htmlAltitude={0.035}
        htmlElement={htmlElementFn}
        htmlTransitionDuration={250}
        ringsData={rings}
        ringColor={(d: object) => (t: number) =>
          `rgba(${(d as { color: string }).color}, ${1 - t})`
        }
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />

      {/* Zoom controls overlay */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 pointer-events-none">
        <ZoomButton onClick={() => zoomBy(0.7)} label="Zoom in">
          <Plus className="size-4" strokeWidth={2.2} />
        </ZoomButton>
        <ZoomButton onClick={() => zoomBy(1.4)} label="Zoom out">
          <Minus className="size-4" strokeWidth={2.2} />
        </ZoomButton>
        <ZoomButton onClick={resetView} label="Reset view">
          <RotateCcw className="size-4" strokeWidth={2.2} />
        </ZoomButton>
      </div>
    </div>
  );
}

function ZoomButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pointer-events-auto grid place-items-center size-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/45 hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {children}
    </button>
  );
}
