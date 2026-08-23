import { describe, it, expect } from "vitest";
import { formatConceptId, parseConceptId } from "./concept";
import type { GeoEntity } from "@/types/geo";
import type { Country } from "@/types/country";

describe("Domain-Aware Concept Identity", () => {
  it("formats legacy world conceptId (3 parts) by default", () => {
    const id = formatConceptId({
      entityId: "ESP",
      skill: "capital",
      subMode: "countryToCap",
    });
    expect(id).toBe("ESP:capital:countryToCap");
  });

  it("formats world conceptId explicitly", () => {
    const id = formatConceptId({
      domain: "world",
      entityId: "FRA",
      skill: "flag",
      subMode: "flagToCountry",
    });
    expect(id).toBe("FRA:flag:flagToCountry");
  });

  it("formats regional/Spain conceptId with domain prefix (4 parts)", () => {
    const id = formatConceptId({
      domain: "spain",
      entityId: "ES-AN",
      skill: "capital",
      subMode: "countryToCap",
    });
    expect(id).toBe("spain:ES-AN:capital:countryToCap");
  });

  it("parses 2-part legacy conceptId as world domain", () => {
    const parsed = parseConceptId("FRA:capital");
    expect(parsed.domain).toBe("world");
    expect(parsed.entityId).toBe("FRA");
    expect(parsed.skill).toBe("capital");
    expect(parsed.subMode).toBeUndefined();
  });

  it("parses 3-part standard conceptId as world domain", () => {
    const parsed = parseConceptId("DEU:flag:flagToCountry");
    expect(parsed.domain).toBe("world");
    expect(parsed.entityId).toBe("DEU");
    expect(parsed.skill).toBe("flag");
    expect(parsed.subMode).toBe("flagToCountry");
  });

  it("parses 4-part regional conceptId correctly", () => {
    const parsed = parseConceptId("spain:ES-CT:capital:countryToCap");
    expect(parsed.domain).toBe("spain");
    expect(parsed.entityId).toBe("ES-CT");
    expect(parsed.skill).toBe("capital");
    expect(parsed.subMode).toBe("countryToCap");
  });

  it("guarantees no collision between world Spain (ESP) and Spain regional entities", () => {
    const countryConcept = formatConceptId({
      domain: "world",
      entityId: "ESP",
      skill: "capital",
      subMode: "countryToCap",
    });
    const regionConcept = formatConceptId({
      domain: "spain",
      entityId: "ES-MD",
      skill: "capital",
      subMode: "countryToCap",
    });
    expect(countryConcept).not.toBe(regionConcept);
    expect(parseConceptId(countryConcept).domain).toBe("world");
    expect(parseConceptId(regionConcept).domain).toBe("spain");
  });

  it("validates GeoEntity structural contract compatibility", () => {
    // Phase 2 entity mockup (Autonomous Community)
    const andalusia: GeoEntity = {
      id: "ES-AN",
      name: "Andalusia",
      domain: "spain",
      category: "autonomous_community",
      coordinates: [37.3891, -5.9845],
      geometryKind: "polygon",
      parentId: "ESP",
      capital: "Seville",
      capitalId: "ES-SVQ",
      flagCode: "es-an",
      area: 87268,
      difficulty: "medium",
    };
    expect(andalusia.id).toBe("ES-AN");
    expect(andalusia.domain).toBe("spain");
    expect(andalusia.category).toBe("autonomous_community");
    expect(andalusia.flagCode).toBe("es-an");

    // Phase 3 entity mockup (River)
    const ebro: GeoEntity = {
      id: "ebro",
      name: "Ebro",
      domain: "spain",
      category: "river",
      coordinates: [40.7167, 0.8667],
      geometryKind: "line",
      parentId: "ESP",
      difficulty: "hard",
    };
    expect(ebro.geometryKind).toBe("line");
    expect(ebro.category).toBe("river");
  });
});
