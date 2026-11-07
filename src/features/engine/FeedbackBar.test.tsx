// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FeedbackBar } from "./FeedbackBar";
import { useAutoAdvance } from "./useAutoAdvance";
import { feedbackContext } from "./feedbackContext";
import type { AnswerState } from "./useSession";
import { COUNTRY_BY_ISO3 } from "@/lib/countries";
import { SPAIN_PROVINCES } from "@/lib/spain";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IRAQ = COUNTRY_BY_ISO3.get("IRQ")!;

function Harness({ state, next }: { state: AnswerState; next: () => void }) {
  useAutoAdvance({ answerState: state, finished: false, next });
  return (
    <FeedbackBar
      show={state !== "idle"}
      state={state === "idle" ? "correct" : state}
      title={IRAQ.name}
      subtitle={feedbackContext(IRAQ)}
      chosen="Iran"
      onNext={next}
      hideNext={state === "correct"}
    />
  );
}

describe("feedback after an answer (Task 21)", () => {
  let host: HTMLDivElement;
  let root: Root;
  const next = vi.fn();
  const render = (state: AnswerState) => act(() => root.render(<Harness state={state} next={next} />));
  const key = (k: string) =>
    act(() => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: k, code: k === " " ? "Space" : k, bubbles: true, cancelable: true }),
      );
    });

  beforeEach(() => {
    vi.useFakeTimers();
    next.mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("a wrong answer focuses Next and auto-advances once after the correction is shown", () => {
    render("wrong");
    act(() => vi.advanceTimersByTime(1_000));
    expect(next).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toContain("Next");
    act(() => vi.advanceTimersByTime(10_000));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("Enter after a miss advances early and cancels the timer", () => {
    render("wrong");
    key("Enter");
    act(() => vi.advanceTimersByTime(10_000));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("a correct answer shows no card, only a screen-reader announcement", () => {
    render("correct");
    expect(host.querySelector("[data-feedback-next]")).toBeNull();
    expect(host.querySelector(".glass-strong")).toBeNull();
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Correct");
  });

  it("srOnly announces a miss without rendering the card", () => {
    act(() =>
      root.render(<FeedbackBar show srOnly state="wrong" title="Iraq" chosen="Iran" onNext={next} />),
    );
    expect(host.querySelector("[data-feedback-next]")).toBeNull();
    expect(host.querySelector('[role="status"]')!.textContent).toContain("You chose Iran · Answer: Iraq");
  });

  it("focuses Next when the bar appears after a miss (idle → wrong, as in the pages)", () => {
    render("idle");
    render("wrong");
    act(() => vi.advanceTimersByTime(1_000));
    expect(document.activeElement?.hasAttribute("data-feedback-next")).toBe(true);
  });

  it("a re-render does not pull focus back to Next from another control", () => {
    render("wrong");
    act(() => vi.advanceTimersByTime(1_000));
    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    render("wrong");
    act(() => vi.advanceTimersByTime(1_000));
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("Enter advances once after a wrong answer", () => {
    render("wrong");
    key("Enter");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("Space advances after a revealed answer", () => {
    render("revealed");
    key(" ");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("Enter on another focused control runs that control, not next", () => {
    render("wrong");
    const other = document.createElement("button");
    const onKey = vi.fn();
    other.addEventListener("keydown", (e) => onKey(e.defaultPrevented));
    document.body.appendChild(other);
    other.focus();
    key("Enter");
    expect(next).not.toHaveBeenCalled();
    expect(onKey).toHaveBeenCalledWith(false);
    other.remove();
  });

  it("Enter with focus on the page body advances once", () => {
    render("wrong");
    (document.activeElement as HTMLElement | null)?.blur();
    key("Enter");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("the status region announces the result, not the buttons", () => {
    render("wrong");
    const region = host.querySelector('[role="status"][aria-live="polite"]')!;
    expect(region.textContent).toContain("Incorrect");
    expect(host.textContent).not.toContain("Not quite");
    expect(region.textContent).not.toContain("Next");
  });

  it("a correct answer still auto-advances", () => {
    render("correct");
    act(() => vi.advanceTimersByTime(1_500));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("shows what was chosen, the answer and a context line in a polite status region", () => {
    render("idle");
    const region = host.querySelector('[role="status"][aria-live="polite"]');
    expect(region).not.toBeNull();
    render("wrong");
    const text = region!.textContent ?? "";
    expect(text).toContain("You chose Iran · Answer: Iraq");
    expect(text).toContain("Western Asia · Neighbours: Iran, Jordan, Kuwait");
    expect(text).not.toContain("Saudi Arabia");
  });
});

describe("feedbackContext", () => {
  it("a country without borders gives only its subregion", () => {
    expect(feedbackContext(COUNTRY_BY_ISO3.get("ATG")!)).toBe("Caribbean");
  });

  it("an empty subregion leaves no leading separator", () => {
    expect(feedbackContext({ ...IRAQ, subregion: "" })).toBe("Neighbours: Iran, Jordan, Kuwait");
  });

  it("a Spanish province names its autonomous community", () => {
    const almeria = SPAIN_PROVINCES.find((p) => p.id === "ES-AL")!;
    expect(feedbackContext(almeria)).toBe("In Andalucía");
  });
});
