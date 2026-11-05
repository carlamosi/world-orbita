// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { COUNTRIES } from "@/lib/countries";
import { SPAIN_CCAA } from "@/lib/spain";
import { McQuestion } from "./ReviewPage";
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
