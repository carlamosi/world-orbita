// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { COUNTRIES } from "@/lib/countries";
import { graded, typeInto, clickButton } from "@/test/cardFormatHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/engine/useSession", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.useSession());
vi.mock("@/features/globe/Globe3D", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.globe());
vi.mock("@/features/engine/ModeDropdown", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.modeDropdown());
vi.mock("@/lib/db/repo", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.repo());
vi.mock("@tanstack/react-router", async () => (await import("@/test/cardFormatHarness")).cardFormatMocks.router());
vi.mock("@/features/engine/SessionEnd", () => ({ SessionEnd: () => null }));
vi.mock("@/components/ui/FlagImage", () => ({ FlagImage: () => null }));

import LocatePage from "./LocatePage";

const target = COUNTRIES[0]!;

describe("Locate Name: recognition and recall are separate cards", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    graded.length = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<LocatePage initialSub="name" />));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("easy (4 options) and hard (typed) grade different conceptIds", async () => {
    clickButton(host, target.name);
    await act(async () => clickButton(host, "Hard"));
    typeInto(host, target.name);

    expect(graded).toHaveLength(2);
    expect(graded[0]!.conceptId).toBe(`${target.iso3}:name:name`);
    expect(graded[1]!.conceptId).not.toBe(graded[0]!.conceptId);
    expect(graded[0]!.opts?.retrievalMode).not.toBe("hard");
  });

  it("typed answers pass retrievalMode hard and softCorrect", async () => {
    await act(async () => clickButton(host, "Hard"));
    typeInto(host, target.name);
    typeInto(host, target.name + "x", { enter: true });

    expect(graded[0]!.opts).toEqual({ retrievalMode: "hard", softCorrect: false });
    expect(graded[1]!.opts).toEqual({ retrievalMode: "hard", softCorrect: true, chosen: target.name + "x" });
  });
});
