import { COUNTRIES, pickRandomCountries } from "@/lib/countries";

/**
 * Validates that when a continent filter is active, all 4 generated option choices
 * (the target country + 3 distractors) belong to the selected continent.
 */
export function verifyContinentDistractors(): { success: boolean; errors: string[] } {
  const continents = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
  const errors: string[] = [];

  for (const continent of continents) {
    const contCountries = COUNTRIES.filter((c) => c.continent === continent);
    for (const target of contCountries) {
      const distractors = pickRandomCountries(3, new Set([target.iso3]), continent);
      const options = [target, ...distractors];
      const wrongContinent = options.filter((o) => o.continent !== continent);
      if (wrongContinent.length > 0) {
        errors.push(
          `Continent ${continent} for target ${target.name} contains invalid options: ${wrongContinent.map((w) => w.name).join(", ")}`,
        );
      }
    }
  }

  return { success: errors.length === 0, errors };
}
