// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { COUNTRIES } from "@/lib/countries";
import type { ChallengeSet } from "@/lib/challenges";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const recordSessionEnd = vi.fn();
vi.mock("@/lib/db/repo", () => ({
  recordSessionEnd: (...a: unknown[]) => recordSessionEnd(...a),
  updateSkillProgress: vi.fn(),
}));
vi.mock("@/features/engine/SessionEnd", () => ({
  SessionEnd: () => <div data-testid="session-end">done</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => <a>{children as never}</a>,
}));
vi.mock("@/components/ui/FlagImage", () => ({ FlagImage: () => null }));

import { ChallengeRunner, type Active } from "./ChallengesPage";

function makeSet(): ChallengeSet {
  return {
    kind: "daily",
    periodKey: "2026-11-05",
    count: 2,
    items: [
      { country: COUNTRIES[0]!, skill: "capital" },
      { country: COUNTRIES[1]!, skill: "capital" },
    ],
  };
}

function Harness() {
  const [active, setActive] = useState<Active | null>({
    set: makeSet(),
    index: 0,
    correct: 0,
    wrong: 0,
    score: 0,
    bestCombo: 0,
    combo: 0,
    startedAt: Date.now(),
    answerState: "idle",
    missedItems: [],
  });
  if (!active) return <div>exited</div>;
  return <ChallengeRunner active={active} setActive={setActive} onExit={() => setActive(null)} />;
}

describe("ChallengeRunner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    recordSessionEnd.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const click = (el: Element | undefined) => {
    act(() => {
      el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };
  const button = (re: RegExp) =>
    Array.from(container.querySelectorAll("button")).find((b) => re.test(b.textContent ?? ""));

  it("finishes a 2-item set without hook-order errors and records the session once", () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => {
      errors.push(a);
    });
    vi.useFakeTimers();
    act(() => root.render(<Harness />));

    // Option 1 may be right or wrong (random); both auto-advance, and a hit shows no Next button.
    for (let i = 0; i < 2; i++) {
      click(button(/^\s*1/));
      act(() => vi.advanceTimersByTime(3_000));
    }
    vi.useRealTimers();

    expect(container.querySelector('[data-testid="session-end"]')).not.toBeNull();
    expect(recordSessionEnd).toHaveBeenCalledTimes(1);
    expect(recordSessionEnd.mock.calls[0]![0]).toMatchObject({
      mode: "challenge_daily",
      totalQuestions: 2,
      periodKey: "2026-11-05",
    });
    expect(errors).toEqual([]);
    spy.mockRestore();
  });
});
