// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { COUNTRIES } from "@/lib/countries";
import { SPAIN_CCAA } from "@/lib/spain";

// A due row whose entity is in no dataset: the Review batch fails lookup entirely.
const orphanRow = {
  conceptId: "world:ZZZ:flag:flagToCountry",
  iso3: "ZZZ",
  skill: "flag",
  fsrs_state: 2,
  fsrs_stability: 5,
  fsrs_difficulty: 5,
  fsrs_due: 0,
  fsrs_reps: 3,
  fsrs_lapses: 0,
  fsrs_last_review: 0,
  updated_at: 0,
  version: 1,
  dirty: 0,
};
vi.mock("@/lib/db/orbita-db", () => ({
  ALL_SKILLS: ["flag"],
  db: () => ({
    concept_progress: { where: () => ({ equals: () => ({ toArray: async () => [orphanRow] }) }) },
  }),
}));
vi.mock("@/lib/fsrs/planner", () => ({ generateDueTodayQueue: (rows: unknown[]) => rows }));
vi.mock("@/lib/db/repo", () => ({
  getPref: vi.fn(async () => undefined),
  setPref: vi.fn(async () => {}),
  recordSessionEnd: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/progressRepo", () => ({ recordConceptAttempt: vi.fn(async () => {}) }));
vi.mock("@/lib/audio", () => ({ playAnswerSound: vi.fn() }));

import ReviewPage, { McQuestion } from "./ReviewPage";
import { reviewLabels } from "./reviewLabels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderOptions(options: unknown[], current: unknown, subMode: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <McQuestion
        options={options as never}
        current={current as never}
        skill="capital"
        subMode={subMode}
        answerState="idle"
        selectedId={null}
        onSelect={() => {}}
      />,
    );
  });
  const labels = Array.from(host.querySelectorAll("button span.truncate")).map(
    (n) => n.textContent,
  );
  act(() => root.unmount());
  host.remove();
  return labels;
}

describe("Review capital questions", () => {
  const world = COUNTRIES.filter((c) => c.capital).slice(0, 4);
  const spain = SPAIN_CCAA.filter((c) => c.capital).slice(0, 4);

  it("capToCountry world: capital prompt, country-name options", () => {
    const labels = renderOptions(world, world[0], "capToCountry");
    expect(reviewLabels("capital", "capToCountry", world[0]!).prompt).toContain(world[0]!.capital!);
    expect(labels).toEqual(world.map((c) => c.name));
    for (const c of world) expect(labels).not.toContain(c.capital);
  });

  it("capToCountry Spain: region-name options", () => {
    const labels = renderOptions(spain, spain[0], "capToCountry");
    expect(reviewLabels("capital", "capToCountry", spain[0]!).prompt).toContain(spain[0]!.capital!);
    expect(labels).toEqual(spain.map((c) => c.name));
  });

  it("countryToCap unchanged: capitals as options", () => {
    const labels = renderOptions(world, world[0], "countryToCap");
    expect(labels).toEqual(world.map((c) => c.capital));
    expect(reviewLabels("capital", "countryToCap", world[0]!).prompt).toBe(
      `What's the capital of ${world[0]!.name}?`,
    );
  });
});

describe("Review page when every row of the batch fails lookup", () => {
  it("renders the nothing-to-review state instead of a blank area", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ReviewPage />);
    });
    for (let i = 0; i < 10 && !host.textContent?.includes("All clear"); i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    }
    expect(host.textContent).toContain("All clear!");
    act(() => root.unmount());
    host.remove();
  });
});
