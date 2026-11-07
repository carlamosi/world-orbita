// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SessionEmpty } from "./SessionEmpty";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SessionEmpty", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  function renderEmpty(props: ComponentProps<typeof SessionEmpty>) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<SessionEmpty {...props} />));
    const el = container;
    const button = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "Practice anyway",
    );
    return { text: el.textContent ?? "", button };
  }

  it("'Practice anyway' calls onPractice", () => {
    const onPractice = vi.fn();
    const { button } = renderEmpty({ reason: "seenAll", hasSeen: true, onPractice });
    act(() => button!.click());
    expect(onPractice).toHaveBeenCalledTimes(1);
  });

  it("everything seen and nothing due: come-back-later copy with the practice button", () => {
    const { text, button } = renderEmpty({ reason: "seenAll", hasSeen: true, onPractice: vi.fn() });

    expect(text).toContain("All caught up");
    expect(text).toContain("You've seen everything here and nothing is due yet. Come back later.");
    expect(text).not.toContain("—");
    expect(button).toBeDefined();
  });

  it("hides 'Practice anyway' when there is nothing seen to practise", () => {
    const { text, button } = renderEmpty({ reason: "seenAll", hasSeen: false, onPractice: vi.fn() });

    expect(text).toContain("Nothing to practise here yet.");
    expect(text).not.toContain("limit");
    expect(text).not.toContain("—");
    expect(button).toBeUndefined();
  });
});
