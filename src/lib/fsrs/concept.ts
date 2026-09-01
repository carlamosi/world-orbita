import type { GeoDomain } from "@/types/geo";

export interface ConceptKey {
  domain?: GeoDomain;
  entityId: string;
  skill: string;
  subMode?: string;
}

export interface ParsedConceptKey {
  domain: string;
  entityId: string;
  skill: string;
  subMode?: string;
}

/**
 * Builds a canonical concept ID for Dexie / FSRS tracking.
 * - For the default "world" domain, preserves the legacy 3-part format `${iso3}:${skill}:${subMode}`
 * - For regional/future domains (e.g. "spain"), uses `${domain}:${entityId}:${skill}:${subMode}`
 */
export function formatConceptId({
  domain = "world",
  entityId,
  skill,
  subMode,
}: ConceptKey): string {
  if (domain === "world") {
    const subModeMap: Record<string, string> = {
      capital: "countryToCap",
      flag: "flagToCountry",
      location: "find",
      name: "name",
    };
    const sm = subMode && subMode !== "default" ? subMode : (subModeMap[skill] ?? skill);
    return `${entityId}:${skill}:${sm}`;
  }
  const sm = subMode ?? skill;
  return `${domain}:${entityId}:${skill}:${sm}`;
}

/**
 * Parses any concept ID (legacy 2-part, standard 3-part, or domain-scoped 4-part)
 * guaranteeing full backward compatibility with existing persisted learner progress.
 */
export function parseConceptId(conceptId: string): ParsedConceptKey {
  const parts = conceptId.split(":");
  if (parts.length >= 4) {
    return {
      domain: parts[0]!,
      entityId: parts[1]!,
      skill: parts[2]!,
      subMode: parts.slice(3).join(":"),
    };
  }
  if (parts.length === 3) {
    return {
      domain: "world",
      entityId: parts[0]!,
      skill: parts[1]!,
      subMode: parts[2]!,
    };
  }
  if (parts.length === 2) {
    return {
      domain: "world",
      entityId: parts[0]!,
      skill: parts[1]!,
    };
  }
  return {
    domain: "world",
    entityId: conceptId,
    skill: "unknown",
  };
}
