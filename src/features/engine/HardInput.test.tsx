// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { HardInput } from "./HardInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setup(target: { name: string; id?: string; nameAlt?: string }, kind: "country" | "spain" = "country") {
  const onSubmit = vi.fn();
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(<HardInput target={target} kind={kind} onSubmit={onSubmit} />);
  });
  const input = host.querySelector("input")!;
  const type = (v: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const enter = () =>
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  return { onSubmit, type, enter };
}

describe("HardInput matching", () => {
  it("Iraq for Iran is wrong, Gambia for Zambia is wrong", () => {
    const a = setup({ name: "Iran", id: "IRN" });
    a.type("Iraq");
    a.enter();
    expect(a.onSubmit).toHaveBeenCalledWith(false, false);
    const b = setup({ name: "Zambia", id: "ZMB" });
    b.type("Gambia");
    b.enter();
    expect(b.onSubmit).toHaveBeenCalledWith(false, false);
  });

  it("a real typo is accepted with exact=false", () => {
    const a = setup({ name: "Iran", id: "IRN" });
    a.type("Irann");
    a.enter();
    expect(a.onSubmit).toHaveBeenCalledWith(true, false);
    const b = setup({ name: "Zambia", id: "ZMB" });
    b.type("Zambai");
    b.enter();
    expect(b.onSubmit).toHaveBeenCalledWith(true, false);
  });

  it("typing Niger for Nigeria does not auto-submit; Enter grades it wrong", () => {
    const a = setup({ name: "Nigeria", id: "NGA" });
    a.type("Niger");
    expect(a.onSubmit).not.toHaveBeenCalled();
    a.enter();
    expect(a.onSubmit).toHaveBeenCalledWith(false, false);
  });

  it("Niger for Niger waits for Enter, then is exact", () => {
    const a = setup({ name: "Niger", id: "NER" });
    a.type("Niger");
    expect(a.onSubmit).not.toHaveBeenCalled();
    a.enter();
    expect(a.onSubmit).toHaveBeenCalledWith(true, true);
  });

  it("exact match still auto-submits when it prefixes nothing", () => {
    const a = setup({ name: "Iran", id: "IRN" });
    a.type("Iran");
    expect(a.onSubmit).toHaveBeenCalledWith(true, true);
  });

  it("an alternative name from the data is accepted as exact", () => {
    const a = setup({ name: "Andalucía", id: "ES-AN", nameAlt: "Andalusia" }, "spain");
    a.type("Andalusia");
    expect(a.onSubmit).toHaveBeenCalledWith(true, true);
  });
});
