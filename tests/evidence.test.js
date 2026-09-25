/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderEvidence, selectEvidence } from "../src/ui/render.js";

describe("evidence selection", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <ol id="evidenceList"></ol>
      <button id="trigger-a"></button>
      <button id="trigger-b"></button>
    `;
    renderEvidence([
      { id: "Text notes-1", source: "Text notes", index: 1, sentence: "First sentence." },
      { id: "Text notes-2", source: "Text notes", index: 2, sentence: "Second sentence." },
    ]);
  });

  it("highlights only the matching evidence sentence", () => {
    const first = document.getElementById("trigger-a");
    const second = document.getElementById("trigger-b");
    selectEvidence("Text notes-1", first);

    const items = [...document.querySelectorAll("#evidenceList li")];
    expect(items[0].classList.contains("is-selected")).toBe(true);
    expect(items[1].classList.contains("is-selected")).toBe(false);
    expect(items[0].getAttribute("aria-current")).toBe("true");
    expect(first.classList.contains("is-active-trigger")).toBe(true);
    expect(document.getElementById("evidenceList").classList.contains("is-filtered")).toBe(true);

    selectEvidence("Text notes-2", second);
    expect(items[0].classList.contains("is-selected")).toBe(false);
    expect(items[1].classList.contains("is-selected")).toBe(true);
    expect(first.classList.contains("is-active-trigger")).toBe(false);
    expect(second.classList.contains("is-active-trigger")).toBe(true);
  });
});
