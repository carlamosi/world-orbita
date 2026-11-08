import { describe, it, expect } from "vitest";
import { State } from "ts-fsrs";
import type { ConceptProgressRow } from "@/lib/db/orbita-db";
import { flagQuestionLevel } from "./flagLevel";

const row = (state: State, extra: Partial<ConceptProgressRow> = {}) =>
  ({ fsrs_state: state, fsrs_lapses: 0, fsrs_reps: 1, ...extra }) as unknown as ConceptProgressRow;

describe("flagQuestionLevel", () => {
  it("a new flag: regular options", () => {
    expect(flagQuestionLevel("FRA:flag:flagToCountry", row(State.New), false)).toEqual({
      showOptions: true,
      lookalikes: false,
      scaffold: false,
    });
  });

  it("right once on options (learning step 1): look-alike options", () => {
    const r = flagQuestionLevel("TCD:flag:flagToCountry", row(State.Learning, { fsrs_learning_steps: 1 }), false);
    expect(r).toEqual({ showOptions: true, lookalikes: true, scaffold: false });
  });

  it("missed on options (learning step 0): regular options again", () => {
    const r = flagQuestionLevel("TCD:flag:flagToCountry", row(State.Learning, { fsrs_learning_steps: 0 }), false);
    expect(r.lookalikes).toBe(false);
  });

  it("an options card whose typed sibling was answered: typing, never a step back", () => {
    const r = flagQuestionLevel("ALB:flag:flagToCountry", row(State.Learning, { fsrs_learning_steps: 1 }), false, true);
    expect(r).toEqual({ showOptions: false, lookalikes: false, scaffold: false });
  });

  it("a typed card: typing", () => {
    expect(flagQuestionLevel("TCD:flag:flagToType", row(State.Review), false)).toEqual({
      showOptions: false,
      lookalikes: false,
      scaffold: false,
    });
  });

  it("a typed card still hard: look-alike options as support", () => {
    const retried = flagQuestionLevel("TCD:flag:flagToType", row(State.Learning), true);
    expect(retried).toEqual({ showOptions: true, lookalikes: true, scaffold: true });
    const lapsedTwice = flagQuestionLevel("TCD:flag:flagToType", row(State.Relearning, { fsrs_lapses: 2 }), false);
    expect(lapsedTwice.scaffold).toBe(true);
    const lapsedOnce = flagQuestionLevel("TCD:flag:flagToType", row(State.Relearning, { fsrs_lapses: 1 }), false);
    expect(lapsedOnce.scaffold).toBe(false);
  });
});
