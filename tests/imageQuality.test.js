import { describe, expect, it } from "vitest";
import { cleanOcrResult } from "../src/pipeline/ocr.js";
import { cleanImageDescription, usableOcr } from "../src/pipeline/imageQuality.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import { barChartSvg } from "../src/ui/charts.js";
import { extractKeywords } from "../src/pipeline/keywords.js";
import { preprocessSources } from "../src/pipeline/preprocess.js";

describe("image quality gates", () => {
  it("does not invent phrases across removed stop words", () => {
    const terms = extractKeywords(preprocessSources([{label:"photo", text:"A green car is parked in front of a yellow building."}])).map(item => item.term);
    expect(terms).toContain("green car");
    expect(terms).not.toContain("parked front");
    expect(terms).not.toContain("front yellow");
  });
  it("rejects low-confidence photo noise even without layout blocks", () => {
    expect(cleanOcrResult({ text: "weird diamond � ee text", confidence: 21 }).text).toBe("");
    expect(cleanOcrResult({ text: "unknown confidence" }).text).toBe("");
  });
  it("preserves readable OCR and rejects damaged caption output", () => {
    expect(usableOcr({text: "Photosynthesis uses sunlight", meanConfidence: 91})).toBe(true);
    expect(cleanImageDescription("A cat � sitting on a chair")).toBe("");
    expect(cleanImageDescription("!!! ??? ♦♦♦")).toBe("");
    expect(cleanImageDescription("A grey cat is sitting on a chair")).toBe("A grey cat is sitting on a chair.");
    expect(cleanImageDescription("A cat sits A cat sits A cat sits A cat sits")).toBe("");
  });
  it("keeps short photo quizzes small and linked to their actual description", async () => {
    const pack = await runPipeline([{label:"cat.jpg", origin:"vision", adapter:"ocr", text:"A grey cat is sitting on a wooden chair."}], {engine:"local"});
    expect(pack.quiz.length).toBeLessThanOrEqual(1);
    expect(pack.quiz[0].evidenceExcerpt).toContain("grey cat");
    expect(JSON.stringify(pack)).not.toContain("�");
  });
  it("places long source labels above the bars and keeps zero counts empty", () => {
    const chart = barChartSvg([{label:"a-very-long-source-name-that-keeps-going-and-going.jpg",value:0}]);
    expect(chart).toContain('class="coverage-name">a-very-long-source-name-that-keeps-going-and-going.jpg');
    expect(chart).toContain('width:0%');
  });
});
