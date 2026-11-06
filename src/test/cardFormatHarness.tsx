import { act } from "react";
import { COUNTRIES } from "@/lib/countries";
import { formatConceptId } from "@/lib/fsrs/concept";

/** Every `submit` of the fake session stores, with the conceptId the engine would grade. */
export const graded: { conceptId: string; ok: boolean; opts?: { retrievalMode?: string; softCorrect?: boolean } }[] = [];

/**
 * Module mocks for page tests that only check which card an answer grades.
 * The fake store derives the conceptId from the subMode the page started it
 * with, the same way the real engine seeds its concepts.
 */
export const cardFormatMocks = {
  useSession: () => ({
    createSessionStore: ({ skill, domain = "world", dataset }: { skill: string; domain?: string; dataset?: { id?: string; iso3?: string }[] }) => {
      const item = ((dataset ?? COUNTRIES) as { id?: string; iso3?: string }[])[0]!;
      let subMode: string | undefined;
      const state = {
        queue: [item],
        conceptQueue: [],
        index: 0,
        answerState: "idle",
        endedAt: null,
        status: "ready",
        score: 0,
        correct: 0,
        wrong: 0,
        missedItems: [],
        startedAt: 0,
        start: async (o?: { subMode?: string }) => {
          subMode = o?.subMode;
        },
        startPractice: async () => {},
        submit: (ok: boolean, opts?: { retrievalMode?: string; softCorrect?: boolean }) => {
          graded.push({
            conceptId: formatConceptId({
              domain: domain as never,
              entityId: item.id ?? item.iso3!,
              skill,
              subMode: subMode || "default",
            }),
            ok,
            opts,
          });
        },
        reveal: () => {},
        next: () => {},
      };
      return () => state;
    },
  }),
  globe: () => ({ default: () => <div data-testid="globe" /> }),
  modeDropdown: () => ({
    ModeDropdown: ({ options, onChange }: { options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
      <div>
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    ),
  }),
  repo: () => ({
    getPref: async () => undefined,
    setPref: async () => {},
    recordSessionEnd: async () => {},
  }),
  router: () => ({
    Link: ({ children }: { children: unknown }) => <a>{children as never}</a>,
    useNavigate: () => () => {},
    useSearch: () => undefined,
  }),
};

export function clickButton(host: HTMLElement, text: string) {
  const btn = Array.from(host.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (!btn) throw new Error(`No button with "${text}"`);
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Types into the only text input; `enter` submits through the fuzzy matcher. */
export function typeInto(host: HTMLElement, value: string, { enter = false } = {}) {
  const input = host.querySelector("input:not([type=hidden])") as HTMLInputElement | null;
  if (!input) throw new Error("No text input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (enter) {
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  }
}
