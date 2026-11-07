import { COUNTRIES } from "@/lib/countries";
import { SPAIN_CAPITALS, SPAIN_CCAA, SPAIN_PROVINCES } from "@/lib/spain";

export type NameKind = "country" | "capital" | "spain" | "spainCapital";

const names = (xs: { name: string; nameAlt?: string }[]) =>
  xs.flatMap((x) => (x.nameAlt ? [x.name, x.nameAlt] : [x.name]));

// Built once: every name a guess could wrongly match, per kind of answer.
const OTHERS: Record<NameKind, string[]> = {
  country: COUNTRIES.map((c) => c.name),
  capital: COUNTRIES.flatMap((c) => (c.capital ? [c.capital] : [])),
  spain: names([...SPAIN_CCAA, ...SPAIN_PROVINCES]),
  spainCapital: names(SPAIN_CAPITALS),
};

/**
 * `alts`: alternative names present in the data (countries.json has none; Spain has `nameAlt`).
 * `others`: names of every entity of the same kind, so a guess equal to another one is wrong.
 */
export function answerNames(
  kind: NameKind,
  target: { nameAlt?: string; capitalId?: string },
): { alts: string[]; others: string[] } {
  let alt: string | undefined;
  if (kind === "spain") alt = target.nameAlt;
  else if (kind === "spainCapital") alt = SPAIN_CAPITALS.find((c) => c.id === target.capitalId)?.nameAlt;
  return { alts: alt ? [alt] : [], others: OTHERS[kind] };
}
