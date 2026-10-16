import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { DirectiveBinding } from "vue";
import { lazyTooltip } from "./tooltip";

type Element = Parameters<NonNullable<typeof lazyTooltip.mounted>>[0];

let el: Element;
const binding = (value: string) => ({ value }) as DirectiveBinding<string>;
const visibleTooltips = () =>
  [...document.querySelectorAll<HTMLElement>(".cdx-tooltip")]
    .filter((t) => t.style.display === "block")
    .map((t) => t.textContent);
const fire = (type: string) => el.dispatchEvent(new Event(type));

beforeEach(() => {
  vi.useFakeTimers();
  el = document.createElement("button") as Element;
  document.body.append(el);
  lazyTooltip.mounted!(el, binding("Copy"), null!, null!);
});
afterEach(() => {
  lazyTooltip.beforeUnmount!(el, binding("Copy"), null!, null!);
  el.remove();
  vi.useRealTimers();
});

describe("lazyTooltip", () => {
  it("creates no tooltip until needed", () => {
    expect(document.querySelectorAll(".cdx-tooltip")).toHaveLength(0);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows immediately on keyboard focus and is removed on blur", () => {
    fire("focus");
    expect(visibleTooltips()).toEqual(["Copy"]);
    expect(el.getAttribute("aria-describedby")).toMatch(/^cdx-tooltip/);
    fire("blur");
    vi.advanceTimersByTime(300);
    expect(document.querySelectorAll(".cdx-tooltip")).toHaveLength(0);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows once the pointer rests for 500 ms", () => {
    fire("mouseenter");
    vi.advanceTimersByTime(499);
    expect(visibleTooltips()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visibleTooltips()).toEqual(["Copy"]);
  });

  it("restarts the delay while the pointer moves", () => {
    fire("mouseenter");
    vi.advanceTimersByTime(400);
    fire("mousemove");
    vi.advanceTimersByTime(400);
    expect(visibleTooltips()).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(visibleTooltips()).toEqual(["Copy"]);
  });

  it("does not show when the pointer leaves early", () => {
    fire("mouseenter");
    vi.advanceTimersByTime(300);
    fire("mouseleave");
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll(".cdx-tooltip")).toHaveLength(0);
  });

  it("updates the text of a shown tooltip", () => {
    fire("focus");
    lazyTooltip.updated!(el, binding("Copied"), null!, null!);
    expect(visibleTooltips()).toEqual(["Copied"]);
  });

  it("uses the latest text when created later", () => {
    lazyTooltip.updated!(el, binding("Undo"), null!, null!);
    fire("focus");
    expect(visibleTooltips()).toEqual(["Undo"]);
  });

  it("ignores empty texts", () => {
    lazyTooltip.updated!(el, binding("  "), null!, null!);
    fire("focus");
    expect(document.querySelectorAll(".cdx-tooltip")).toHaveLength(0);
  });
});
