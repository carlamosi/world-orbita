// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SessionEmpty } from "./SessionEmpty";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SessionEmpty", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  it("shows the caught-up copy and 'Practice anyway' calls onPractice", () => {
    const onPractice = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<SessionEmpty onPractice={onPractice} />));

    expect(container.textContent).toContain("All caught up");
    expect(container.textContent).toContain(
      "Nothing is due and you've met today's new-card limit.",
    );
    expect(container.textContent).not.toContain("—");
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Practice anyway",
    );
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(onPractice).toHaveBeenCalledTimes(1);
  });
});
