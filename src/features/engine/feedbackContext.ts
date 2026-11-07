import { COUNTRY_BY_ISO3 } from "@/lib/countries";
import { SPAIN_CCAA, type SpainEntity } from "@/lib/spain";
import type { Country } from "@/types/country";

/** One retrieval cue after a miss: region and neighbours, or a province's community. */
export function feedbackContext(item: Country | SpainEntity): string | null {
  if ("iso3" in item) {
    const near = item.borders.slice(0, 3).flatMap((b) => COUNTRY_BY_ISO3.get(b)?.name ?? []);
    return [item.subregion, near.length && `Neighbours: ${near.join(", ")}`].filter(Boolean).join(" · ") || null;
  }
  if (item.category !== "province") return null;
  const ccaa = SPAIN_CCAA.find((c) => c.id === item.parentId);
  return ccaa ? `In ${ccaa.name}` : null;
}
