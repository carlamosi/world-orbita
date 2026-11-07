import data from "@/data/countries.json";
import type { CountriesDataset, Country } from "@/types/country";

const dataset = data as CountriesDataset;

export const COUNTRIES: readonly Country[] = Object.freeze(dataset.countries);

export const COUNTRY_BY_ISO3: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.iso3, c]),
);

/**
 * `n` wrong options for `target`: land neighbours first, then the same
 * subregion, then the same continent, then anywhere (random within each tier),
 * so a right answer means telling look-alikes apart.
 */
export function pickDistractors(target: Country, n: number, continent?: string): Country[] {
  let pool = COUNTRIES.filter((c) => c.iso3 !== target.iso3);
  if (continent && continent !== "All") {
    const continentPool = pool.filter((c) => c.continent === continent);
    if (continentPool.length >= n) pool = continentPool;
  }
  const tier = (c: Country) =>
    target.borders.includes(c.iso3)
      ? 0
      : target.subregion && c.subregion === target.subregion
        ? 1
        : c.continent === target.continent
          ? 2
          : 3;
  return pool
    .map((c) => ({ c, key: tier(c) + Math.random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, n)
    .map((x) => x.c);
}
