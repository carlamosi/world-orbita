import { COUNTRY_BY_ISO3 } from "@/lib/countries";
import type { Country } from "@/types/country";

/**
 * Flags people mix up: same colours, same layout or one small detail apart.
 * Options drawn from one group make the learner tell the flags apart instead
 * of ruling out obvious misfits (desirable difficulty, before typing).
 */
export const FLAG_LOOKALIKE_GROUPS: readonly (readonly string[])[] = [
  ["TCD", "ROU", "AND", "MDA"], // blue-yellow-red verticals
  ["IDN", "MCO", "POL", "SGP"], // red over white
  ["IRL", "CIV", "ITA", "MEX"], // green-white-orange/red verticals
  ["NLD", "LUX", "FRA", "PRY", "HRV"], // red-white-blue
  ["RUS", "SVN", "SVK", "SRB"], // white-blue-red horizontals with or without arms
  ["AUS", "NZL", "FJI", "TUV"], // Union Jack and stars
  ["NOR", "ISL", "DNK", "FIN", "SWE"], // Nordic crosses
  ["SEN", "MLI", "GIN", "CMR"], // green-yellow-red verticals
  ["GHA", "BOL", "LTU", "ETH", "GNB"], // red-yellow-green
  ["COL", "ECU", "VEN"], // yellow-blue-red
  ["HND", "NIC", "SLV", "GTM", "ARG"], // blue-white-blue
  ["QAT", "BHR"], // serrated maroon or red
  ["EGY", "SYR", "IRQ", "YEM"], // red-white-black
  ["JOR", "KWT", "ARE", "SDN"], // pan-Arab colours
  ["BEL", "DEU"], // black-yellow-red
  ["LBR", "MYS", "USA"], // stripes with a blue canton
  ["NER", "IND"], // orange-white-green with a disc
  ["JPN", "BGD", "PLW"], // single disc
  ["HTI", "LIE"], // blue over red
  ["THA", "CRI"], // red-white-blue five stripes
  ["AUT", "LVA", "LBN"], // red-white-red
  ["HUN", "BGR", "TJK"], // tricolour horizontals
] as const;

/** Countries whose flags look like `iso3`'s (excluding it), in group order. */
export function flagLookalikesOf(iso3: string): Country[] {
  const out: Country[] = [];
  for (const group of FLAG_LOOKALIKE_GROUPS) {
    if (!group.includes(iso3)) continue;
    for (const other of group) {
      const c = other !== iso3 ? COUNTRY_BY_ISO3.get(other) : undefined;
      if (c && !out.includes(c)) out.push(c);
    }
  }
  return out;
}

/**
 * `n` distractors for a flag question: look-alikes first (random order), then
 * `fallback` fills what is left, with no duplicates and never the target.
 */
export function pickLookalikeDistractors(target: Country, n: number, fallback: Country[]): Country[] {
  const picked = shuffle(flagLookalikesOf(target.iso3)).slice(0, n);
  for (const c of fallback) {
    if (picked.length >= n) break;
    if (c.iso3 !== target.iso3 && !picked.includes(c)) picked.push(c);
  }
  return picked;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
