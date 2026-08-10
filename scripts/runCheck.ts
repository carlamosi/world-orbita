import data from "../src/data/countries.json" with { type: "json" };

const COUNTRIES = data.countries;

function pickRandomCountries(n: number, exclude: Set<string> = new Set(), continent?: string) {
  let pool = COUNTRIES.filter((c) => !exclude.has(c.iso3));
  if (continent && continent !== "All") {
    const continentPool = pool.filter((c) => c.continent === continent);
    if (continentPool.length >= n) {
      pool = continentPool;
    }
  }
  const out: any[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]!);
  }
  return out;
}

const continents = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
let ok = true;
const errors: string[] = [];

for (const cont of continents) {
  const contCountries = COUNTRIES.filter((c) => c.continent === cont);
  for (const target of contCountries) {
    const distractors = pickRandomCountries(3, new Set([target.iso3]), cont);
    const options = [target, ...distractors];
    const wrong = options.filter((o) => o.continent !== cont);
    if (wrong.length > 0) {
      errors.push(`FAILED for continent=${cont}, target=${target.name}: found wrong options ${wrong.map(w => w.name).join(', ')}`);
      ok = false;
    }
  }
}

console.log("=========================================");
console.log("CONTINENT DISTRACTOR VERIFICATION RESULT:");
console.log("Success:", ok);
if (!ok) {
  console.error("Errors:", errors);
  process.exit(1);
} else {
  console.log("CONFIRMED: For every continent, all 4 options belong to that continent!");
}
console.log("=========================================");
