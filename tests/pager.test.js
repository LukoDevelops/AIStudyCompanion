import { describe, expect, it, vi } from "vitest";
import {
  clampPage,
  createPager,
  pageCount,
  pageForIndex,
  pagerLabel,
  sliceForPage,
} from "../src/ui/pager.js";

describe("pagination maths", () => {
  it("counts pages and clamps out-of-range requests", () => {
    expect(pageCount(409, 10)).toBe(41);
    expect(pageCount(0, 10)).toBe(1);
    expect(clampPage(0, 409, 10)).toBe(1);
    expect(clampPage(999, 409, 10)).toBe(41);
    expect(clampPage(Number.NaN, 409, 10)).toBe(1);
  });

  it("maps a sentence index to the page that holds it", () => {
    expect(pageForIndex(0, 10)).toBe(1);
    expect(pageForIndex(9, 10)).toBe(1);
    expect(pageForIndex(10, 10)).toBe(2);
    expect(pageForIndex(408, 10)).toBe(41);
  });

  it("slices the window for a page and labels the range", () => {
    const items = Array.from({ length: 25 }, (_, index) => index);
    const view = sliceForPage(items, 3, 10);

    expect(view.start).toBe(20);
    expect(view.items).toEqual([20, 21, 22, 23, 24]);
    expect(pagerLabel(3, 25, 10)).toBe("21–25 of 25 · page 3 of 3");
    expect(pagerLabel(1, 0, 10)).toBe("No sentences yet");
  });
});

describe("pager controller", () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ id: `s-${index + 1}` }));

  it("renders one window and steps through the pages", () => {
    const onRender = vi.fn();
    const pager = createPager({ perPage: 10, onRender });
    pager.setItems(items);

    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender.mock.calls[0][0]).toHaveLength(10);
    expect(onRender.mock.calls[0][1].pages).toBe(3);

    expect(pager.step("last")).toBe(3);
    expect(pager.step("next")).toBe(3);
    expect(pager.step("first")).toBe(1);
  });

  it("reveals the page that holds a given sentence id", () => {
    const onRender = vi.fn();
    const pager = createPager({ perPage: 10, onRender });
    pager.setItems(items);

    expect(pager.revealId("s-24")).toBe(3);
    expect(pager.revealIndex(10)).toBe(2);
    expect(pager.revealId("missing")).toBe(2);
  });

  it("does not re-render when the page is already showing", () => {
    const onRender = vi.fn();
    const pager = createPager({ perPage: 10, onRender });
    pager.setItems(items);
    onRender.mockClear();

    pager.revealId("s-1");
    pager.revealId("s-2");

    expect(onRender).not.toHaveBeenCalled();
  });
});
