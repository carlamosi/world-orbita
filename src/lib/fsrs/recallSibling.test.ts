import { describe, it, expect } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { learnedRecallSiblings } from "./recallSibling";

const card = (conceptId: string, state: State) =>
  ({ conceptId, fsrs_state: state }) as unknown as ConceptProgressRow;

describe("learnedRecallSiblings", () => {
  it("marks a recognition card whose typed sibling has been answered", () => {
    const set = learnedRecallSiblings([
      card("ALB:flag:flagToCountry", State.Learning),
      card("ALB:flag:flagToType", State.Review),
      card("FRA:flag:flagToCountry", State.Review),
      card("spain:ES-AN:name:name", State.Review),
      card("spain:ES-AN:name:nameType", State.Learning),
    ]);
    expect([...set].sort()).toEqual(["ALB:flag:flagToCountry", "spain:ES-AN:name:name"]);
  });

  it("a typed sibling never answered (New) does not count", () => {
    const set = learnedRecallSiblings([
      card("ALB:flag:flagToCountry", State.Review),
      card("ALB:flag:flagToType", State.New),
    ]);
    expect(set.size).toBe(0);
  });

  it("other skills are untouched", () => {
    const set = learnedRecallSiblings([
      card("FRA:location:find", State.Review),
      card("FRA:capital:countryToCap", State.Review),
      card("FRA:capital:capToCountry", State.Review),
    ]);
    expect(set.size).toBe(0);
  });
});
