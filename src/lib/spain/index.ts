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
