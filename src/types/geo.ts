import type { Difficulty } from "./country";

export type GeoDomain = "world" | "spain" | (string & {});

export type GeoEntityCategory =
  | "country"
  | "autonomous_community"
  | "province"
  | "country_capital"
  | "autonomous_community_capital"
  | "province_capital"
  // Physical geography (Phase 3 extension points)
  | "river"
  | "mountain"
  | "mountain_range"
  | "sea"
  | "ocean"
  | "strait"
  | "island"
  | "gulf"
  | "cape"
  | (string & {});

export type GeometryKind = "point" | "line" | "polygon";

/**
 * Minimum shared geographic abstraction.
 * Enables entity identification via stable ID, domain, and category
 * without assuming every entity is a country keyed by ISO3.
 */
export interface GeoEntity {
  /** Stable unique identifier within its domain (e.g. "ESP", "ES-AN", "ES-SE", "ebro") */
  id: string;
  /** Primary display name */
  name: string;
  /** Domain/scope of the entity (e.g. "world", "spain") */
  domain: GeoDomain;
  /** Geographic/administrative category */
  category: GeoEntityCategory;
  /** Primary point coordinates [latitude, longitude] */
  coordinates: [number, number];
  /** Geometric classification for rendering & spatial validation */
  geometryKind?: GeometryKind;
  /** Parent entity ID in the administrative hierarchy (e.g. "ES-AN" for province "ES-SE") */
  parentId?: string | null;
  /** Associated capital name (if applicable) */
  capital?: string | null;
  /** Associated capital point coordinates [latitude, longitude] */
  capitalCoords?: [number, number];
  /** Associated capital entity ID (if modeled as a distinct entity) */
  capitalId?: string | null;
  /** Optional flag identifier/code (for entities with flags, e.g. countries or ACs) */
  flagCode?: string;
  /** Approximate land or surface area (km²) */
  area?: number;
  /** Learning difficulty tier */
  difficulty?: Difficulty;
}

/**
 * Minimal administrative hierarchy representation.
 * Supports: Country -> Autonomous Community -> Province
 */
export interface AdministrativeHierarchy {
  countryId: string;
  autonomousCommunityId?: string | null;
  provinceId?: string | null;
}
