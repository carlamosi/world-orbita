/**
 * Spain geometry loader.
 *
 * Lazily loads the es-atlas TopoJSON files (bundled into the Vite asset
 * graph) and converts them to GeoJSON features, patching each feature's
 * id from the raw INE 2-digit code to the canonical ISO 3166-2 code so
 * Globe3D can match them to SpainEntity.id values directly.
 *
 * Gibraltar is excluded (INE CCAA '20', province '54').
 * Province entries for Ceuta/Melilla (INE '51'/'52') are kept for map
 * display purposes but are NOT exposed as quiz-able province entities.
 */

import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { CCAA_INE_TO_ISO, PROVINCE_INE_TO_ISO } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpainFeatureProperties {
  /** ISO 3166-2 code, e.g. 'ES-AN', 'ES-VI' */
  id: string;
  /** Official name from the TopoJSON source */
  name: string;
  /** Original INE 2-digit code */
  ineCode: string;
}

export type SpainFeature = Feature<
  MultiPolygon | Polygon,
  SpainFeatureProperties
>;

export type SpainFeatureCollection = FeatureCollection<
  MultiPolygon | Polygon,
  SpainFeatureProperties
>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip noisy INE IDs that should not appear in quiz data. */
const CCAA_EXCLUDE = new Set(["20"]); // Gibraltar
const PROVINCE_EXCLUDE = new Set(["54"]); // Gibraltar province

function patchFeature(
  f: Feature,
  ineToIso: Record<string, string>,
  exclude: Set<string>,
): SpainFeature | null {
  const rawId = String(f.id ?? "");
  if (exclude.has(rawId)) return null;
  const iso = ineToIso[rawId];
  if (!iso) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (f.properties ?? {}) as any;
  return {
    ...f,
    id: iso,
    properties: {
      id: iso,
      name: String(props.name ?? ""),
      ineCode: rawId,
    },
  } as SpainFeature;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

let _ccaaPromise: Promise<SpainFeatureCollection> | null = null;
let _provincesPromise: Promise<SpainFeatureCollection> | null = null;

/**
 * Lazily load and return GeoJSON features for Spain's Autonomous Communities.
 * Result is cached after the first call.
 */
export async function loadSpainCCAAFeatures(): Promise<SpainFeatureCollection> {
  if (_ccaaPromise) return _ccaaPromise;
  _ccaaPromise = (async () => {
    const topo = (await import(
      "@/assets/geo/spain/autonomous_regions.json"
    )) as unknown as Topology;

    const collection = feature(
      topo,
      topo.objects["autonomous_regions"] as GeometryCollection,
    ) as FeatureCollection;

    const features = collection.features
      .map((f) => patchFeature(f, CCAA_INE_TO_ISO, CCAA_EXCLUDE))
      .filter((f): f is SpainFeature => f !== null);

    return { type: "FeatureCollection", features };
  })();
  return _ccaaPromise;
}

/**
 * Lazily load and return GeoJSON features for Spain's Provinces.
 * Result is cached after the first call.
 */
export async function loadSpainProvinceFeatures(): Promise<SpainFeatureCollection> {
  if (_provincesPromise) return _provincesPromise;
  _provincesPromise = (async () => {
    const topo = (await import(
      "@/assets/geo/spain/provinces.json"
    )) as unknown as Topology;

    const collection = feature(
      topo,
      topo.objects["provinces"] as GeometryCollection,
    ) as FeatureCollection;

    const features = collection.features
      .map((f) => patchFeature(f, PROVINCE_INE_TO_ISO, PROVINCE_EXCLUDE))
      .filter((f): f is SpainFeature => f !== null);

    return { type: "FeatureCollection", features };
  })();
  return _provincesPromise;
}

/** Resolve a feature by its ISO 3166-2 id from a collection. */
export function findFeatureById(
  collection: SpainFeatureCollection,
  id: string,
): SpainFeature | undefined {
  return collection.features.find((f) => f.properties.id === id);
}
