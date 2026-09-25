import { describe, expect, it } from "vitest";
import { scoreGrounding, tokenOverlap } from "../src/pipeline/grounding.js";

describe("grounding", () => {
  it("gives complete overlap a 100% grounding score", () => {
    const tokens = ["source", "checking", "helps", "students"];
    expect(tokenOverlap("Source checking helps students.", tokens)).toBe(1);

    const scored = scoreGrounding("Source checking helps students.", { tokens }, null, 0);
    expect(scored.overlapScore).toBe(100);
    expect(scored.groundingScore).toBe(100);
  });

  it("gives no shared tokens a 0% overlap score", () => {
    expect(tokenOverlap("cats and dogs", ["retrieval", "pipeline"])).toBe(0);
    expect(scoreGrounding("cats and dogs", { tokens: ["retrieval"] }, null, 0).groundingScore).toBe(0);
  });
});
