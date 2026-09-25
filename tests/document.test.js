import { describe, expect, it } from "vitest";
import {
  findRunningFurniture,
  normaliseDocument,
  rejoinHyphenatedLines,
  splitDocumentSentences,
} from "../src/pipeline/document.js";

function reportPages() {
  return [
    [
      "AI Study Companion - Draft Report",
      "Chapter 1 - Introduction",
      "This project is called AI Study Companion and it turns mixed material into a revision",
      "pack that a learner can check.",
      "Page 1 of 3",
    ],
    [
      "AI Study Companion - Draft Report",
      "Chapter 2 - Design",
      "The design is based on a modular web application architecture with named stages.",
      "Page 2 of 3",
    ],
    [
      "AI Study Companion - Draft Report",
      "Chapter 3 - Evaluation",
      "Automated fixtures check that the workflow completes and the structure holds.",
      "Page 3 of 3",
    ],
  ];
}

describe("document normalisation", () => {
  it("finds the running header that repeats across pages", () => {
    const furniture = findRunningFurniture(reportPages());
    expect(furniture.has("ai study companion - draft report")).toBe(true);
  });

  it("strips running headers and numbered page footers", () => {
    const { blocks, stats } = normaliseDocument({ pages: reportPages() });
    const text = blocks.map((block) => block.text).join(" ");

    expect(text).not.toContain("Draft Report");
    expect(text).not.toMatch(/Page \d of \d/);
    expect(stats.removedFurniture).toBeGreaterThanOrEqual(6);
    expect(stats.pageCount).toBe(3);
  });

  it("keeps chapter titles as headings and attaches them to the body", () => {
    const { blocks } = normaliseDocument({ pages: reportPages() });
    const headings = blocks.filter((block) => block.kind === "heading");
    const body = blocks.filter((block) => block.kind !== "heading");

    expect(headings.map((block) => block.text)).toContain("Chapter 2 - Design");
    expect(body.every((block) => block.heading)).toBe(true);
    expect(body.some((block) => block.heading === "Chapter 3 - Evaluation")).toBe(true);
  });

  it("merges rows that were only split by page width", () => {
    const { blocks } = normaliseDocument({ pages: reportPages() });
    const merged = blocks.find((block) => block.text.includes("revision pack"));

    expect(merged.text).toContain("turns mixed material into a revision pack");
  });

  it("rejoins words broken by a hyphen at the end of a line", () => {
    expect(rejoinHyphenatedLines(["orchestra-", "tion matters"])).toEqual([
      "orchestration matters",
    ]);
    expect(rejoinHyphenatedLines(["a real line.", "Another line."])).toHaveLength(2);
  });

  it("splits a run of inline bullets into separate items", () => {
    const { blocks } = normaliseDocument({
      text: "\u2022 Chapter 1 - Introduction \u2022 Chapter 2 - Literature Review \u2022 Chapter 3 - Design",
    });
    const bullets = blocks.filter((block) => block.kind === "bullet");

    expect(bullets).toHaveLength(3);
    expect(bullets[1].text).toBe("Chapter 2 - Literature Review");
  });

  it("removes duplicated long lines", () => {
    const { blocks } = normaliseDocument({
      text: [
        "Retrieval happens before generation so the answer stays anchored.",
        "Retrieval happens before generation so the answer stays anchored.",
      ].join("\n"),
    });

    expect(blocks).toHaveLength(1);
  });

  it("does not split sentences on abbreviations or decimals", () => {
    const sentences = splitDocumentSentences(
      "Retrieval uses e.g. BM25 and version 1.5 of the index. Students should still check the source."
    );

    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("e.g. BM25");
    expect(sentences[0]).toContain("1.5");
  });
});
