import { describe, expect, it } from "vitest";
import { compareEngines, packMetrics } from "../src/pipeline/compare.js";
import { sample } from "../src/sample.js";

describe("engine compare", () => {
  it("returns metrics for both baseline and improved engines", async () => {
    const comparison = await compareEngines(
      [
        { label: "Text notes", text: sample.text, origin: "paste", adapter: "text" },
        { label: "Audio transcript", text: sample.audio, origin: "paste", adapter: "audio-paste" },
      ],
      { random: () => 0.2 }
    );

    expect(comparison.baseline.engine).toBe("baseline");
    expect(comparison.local.engine).toBe("local");
    expect(comparison.baseline.conceptCount).toBeGreaterThan(0);
    expect(comparison.local.quizTypes).toBeGreaterThanOrEqual(1);
    expect(packMetrics(comparison.packs.local).linkCoverage).toBe(100);
  });
});
