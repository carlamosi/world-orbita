import { describe, it, expect } from "vitest";
import { adaptiveNewLimit, missFeedbackMs } from "./learningLoad";

const answers = (right: number, wrong: number) => [
  ...Array<boolean>(right).fill(true),
  ...Array<boolean>(wrong).fill(false),
];

describe("adaptiveNewLimit: keep recent first tries near 85% right", () => {
  it("too little history: a full session of new cards", () => {
    expect(adaptiveNewLimit(answers(2, 3), 10)).toBe(10);
  });
  it("85% or better: a full session", () => {
    expect(adaptiveNewLimit(answers(26, 4), 10)).toBe(10);
  });
  it("between 75% and 85%: half", () => {
    expect(adaptiveNewLimit(answers(24, 6), 10)).toBe(5);
  });
  it("below 75%: only a few, never zero", () => {
    expect(adaptiveNewLimit(answers(15, 15), 10)).toBe(3);
  });
  it("looks only at the latest 30 answers", () => {
    // Newest first: 30 right, then 50 old misses that no longer count.
    expect(adaptiveNewLimit(answers(30, 50), 10)).toBe(10);
  });
});

describe("missFeedbackMs: confident errors get longer to look", () => {
  it("a fast miss (confident) waits longer than the default", () => {
    expect(missFeedbackMs(800, "location")).toBe(3500);
  });
  it("a normal-speed miss keeps the default", () => {
    expect(missFeedbackMs(4000, "location")).toBe(2500);
  });
  it("a slow miss (unsure) moves on a little sooner", () => {
    expect(missFeedbackMs(20_000, "location")).toBe(2000);
  });
  it("typing gets more time before counting as fast", () => {
    expect(missFeedbackMs(3000, "capital", "hard")).toBe(3500);
    expect(missFeedbackMs(3000, "capital")).toBe(2500);
  });
});
