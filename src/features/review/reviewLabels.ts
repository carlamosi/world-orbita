import type { Country } from "@/types/country";
import type { SpainEntity } from "@/lib/spain";

type Entity = Country | SpainEntity;

function isSpain(item: Entity): item is SpainEntity {
  return "domain" in item && item.domain === "spain";
}

/**
 * Prompt and option labels for a Review multiple-choice question.
 * capToCountry shows the capital as the prompt and names as options;
 * every other capital question asks for a capital and lists capitals.
 */
export function reviewLabels(
  skill: string,
  subMode: string,
  item: Entity,
): { prompt: string; optionLabel: (opt: Entity) => string } {
  if (skill === "capital" && subMode === "capToCountry") {
    return {
      prompt: `Which ${isSpain(item) ? "region" : "country"}'s capital is ${item.capital}?`,
      optionLabel: (opt) => opt.name,
    };
  }
  if (skill === "capital") {
    return {
      prompt: `What's the capital of ${item.name}?`,
      optionLabel: (opt) => opt.capital ?? opt.name,
    };
  }
  return { prompt: "", optionLabel: (opt) => opt.name };
}
