import { describe, expect, it } from "vitest";
import {
  cleanOcrResult,
  collapseRepeats,
  isJunkToken,
  orderRegions,
} from "../src/pipeline/ocr.js";

function word(text, confidence) {
  return { text, confidence };
}

describe("OCR cleanup", () => {
  it("treats decorative symbols and vowel-free runs as junk", () => {
    expect(isJunkToken("\u00a9")).toBe(true);
    expect(isJunkToken("\u00ab\u00ab")).toBe(true);
    expect(isJunkToken("x")).toBe(true);
    expect(isJunkToken("rchatsrr")).toBe(false);
    expect(isJunkToken("bcdfg")).toBe(true);
    expect(isJunkToken("retrieval")).toBe(false);
    expect(isJunkToken("2025")).toBe(false);
  });

  it("collapses repeated words and phrases", () => {
    expect(collapseRepeats("Pros Pros")).toBe("Pros");
    expect(collapseRepeats("Key Features Key Features Key Features")).toBe("Key Features");
    expect(collapseRepeats("the model reads the model")).toBe("the model reads the model");
  });

  it("reads columns in order rather than straight across the page", () => {
    const regions = [
      { bbox: { x0: 700, y0: 10, x1: 900, y1: 60 }, lines: [] },
      { bbox: { x0: 20, y0: 200, x1: 300, y1: 260 }, lines: [] },
      { bbox: { x0: 20, y0: 10, x1: 300, y1: 60 }, lines: [] },
    ];

    const ordered = orderRegions(regions, { pageWidth: 900 });
    expect(ordered.map((region) => region.bbox.y0)).toEqual([10, 200, 10]);
    expect(ordered[2].bbox.x0).toBe(700);
  });

  it("drops low-confidence words and keeps the readable text", () => {
    const result = cleanOcrResult({
      bbox: { x0: 0, y0: 0, x1: 600, y1: 400 },
      blocks: [
        {
          bbox: { x0: 10, y0: 10, x1: 300, y1: 80 },
          lines: [
            {
              confidence: 88,
              words: [
                word("Key", 94),
                word("Features", 92),
                word("\u00a9Groku", 21),
                word("sa)", 18),
              ],
            },
            {
              confidence: 90,
              words: [word("Pros", 91), word("Pros", 90)],
            },
          ],
        },
        {
          bbox: { x0: 10, y0: 10, x1: 300, y1: 80 },
          lines: [{ confidence: 12, words: [word("mock", 30), word("wt", 22)] }],
        },
      ],
    });

    expect(result.lines).toEqual(["Key Features", "Pros"]);
    expect(result.text).not.toContain("Groku");
    expect(result.droppedWords).toBeGreaterThanOrEqual(4);
    expect(result.meanConfidence).toBeGreaterThan(80);
  });

  it("falls back to plain text when no layout information is available", () => {
    const result = cleanOcrResult({
      text: "Retrieval augmented generation\nRetrieval augmented generation\n\u00a9",
      confidence: 77,
    });

    expect(result.lines[0]).toBe("Retrieval augmented generation");
    expect(result.lines).not.toContain("\u00a9");
  });
});
