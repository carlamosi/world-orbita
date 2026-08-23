/**
 * Spain geography module — public API.
 *
 * Import from here; do not import from sub-modules directly.
 */

export type { SpainEntity, SpainCategory } from "./types";
export { CCAA_INE_TO_ISO, PROVINCE_INE_TO_ISO } from "./types";

export { SPAIN_CCAA, SPAIN_PROVINCES, SPAIN_CAPITALS, SPAIN_ALL } from "./data";

export type {
  SpainFeature,
  SpainFeatureCollection,
  SpainFeatureProperties,
} from "./geo";
export {
  loadSpainCCAAFeatures,
  loadSpainProvinceFeatures,
  findFeatureById,
} from "./geo";

export type { ValidationResult } from "./validate";
export { validateSpainDataset } from "./validate";

// Eagerly resolve SVG assets through Vite bundling
const SPAIN_FLAG_URLS = import.meta.glob<string>(
  "/src/assets/flags/spain/*.svg",
  { eager: true, query: "?url", import: "default" }
);

export function getSpainFlagUrl(flagCode?: string): string | undefined {
  if (!flagCode) return undefined;
  const key = `/src/assets/flags/spain/${flagCode.toLowerCase()}.svg`;
  return SPAIN_FLAG_URLS[key] || `/assets/flags/spain/${flagCode.toLowerCase()}.svg`;
}
