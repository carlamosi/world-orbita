// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));
vi.mock("@/lib/db/orbita-db", () => ({ db: () => ({}) }));
vi.mock("@tanstack/react-router", () => ({ Link: (p: { children: unknown }) => p.children }));

import { SessionEnd } from "./SessionEnd";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SessionEnd summary (Task 22)", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("shows first-try recall over distinct cards and lists tricky cards", () => {
    act(() =>
      root.render(
        <SessionEnd
          show
          firstTryCorrect={9}
          correct={10}
          total={10}
          masteredNow={2}
          trickyItems={[{ id: "t", prompt: "Germany", flagIso2: "de" }]}
          missedItems={[{ id: "m", prompt: "France", answer: "France" }]}
        />,
      ),
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("First try");
    expect(text).not.toContain("right first try");
    expect(text).not.toMatch(/\bmastered\b(?! \()/);
    expect(text).toContain("9/10");
    expect(text).toContain("90%");
    expect(text).toContain("2 now mastered");
    expect(text).toContain("Tricky");
    expect(text).toContain("Germany");
  });
});
