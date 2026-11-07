// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SPAIN_CCAA } from "@/lib/spain";
import { graded, typeInto, clickButton } from "@/test/cardFormatHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const search = vi.hoisted(() => ({ skill: "name" as string }));

vi.mock("@/features/engine/useSession", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.useSession());
vi.mock("@/features/globe/Globe3D", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.globe());
vi.mock("@/features/engine/ModeDropdown", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.modeDropdown());
vi.mock("@/lib/db/repo", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.repo());
vi.mock("@tanstack/react-router", async () => ({
  ...(await import("@/test/cardFormatHarness")).cardFormatMocks.router(),
  useSearch: () => search,
}));
vi.mock("@/features/engine/SessionEnd", () => ({ SessionEnd: () => null }));
vi.mock("@/lib/spain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/spain")>()),
  loadSpainCCAAFeatures: async () => null,
  loadSpainProvinceFeatures: async () => null,
}));

import SpainPage from "./SpainPage";

const target = SPAIN_CCAA[0]!;

describe.each(["name", "flags"])("Spain %s: recognition and recall are separate cards", (skill) => {
  let host: HTMLDivElement;
  let root: Root;
  async function mount() {
    graded.length = 0;
    search.skill = skill;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<SpainPage />));
  }
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("easy (choices) and hard (typing) grade different conceptIds", async () => {
    await mount();
    clickButton(host, target.name);
    await act(async () => clickButton(host, "Hard (Typing)"));
    typeInto(host, target.name);

    expect(graded).toHaveLength(2);
    expect(graded[0]!.conceptId.split(":")).toHaveLength(4);
    expect(graded[1]!.conceptId.split(":")).toHaveLength(4);
    expect(graded[1]!.conceptId).not.toBe(graded[0]!.conceptId);
  });

  it("typed answers pass retrievalMode hard and softCorrect", async () => {
    await mount();
    await act(async () => clickButton(host, "Hard (Typing)"));
    typeInto(host, target.name);
    typeInto(host, target.name + "x", { enter: true });

    expect(graded[0]!.opts).toEqual({ retrievalMode: "hard", softCorrect: false });
    expect(graded[1]!.opts).toEqual({ retrievalMode: "hard", softCorrect: true, chosen: target.name + "x" });
  });
});

describe("Spain capitals (typed only)", () => {
  it("forwards softCorrect", async () => {
    graded.length = 0;
    search.skill = "capitals";
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<SpainPage />));
    typeInto(host, target.capital! + "x", { enter: true });
    expect(graded[0]!.opts).toEqual({ retrievalMode: "hard", softCorrect: true, chosen: target.capital! + "x" });
    act(() => root.unmount());
    host.remove();
  });
});
