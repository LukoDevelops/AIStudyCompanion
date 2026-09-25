import { describe, expect, it } from "vitest";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import { sample } from "../src/sample.js";

const mixedSources = [
  { label: "Text notes", text: sample.text, origin: "paste", adapter: "text" },
  { label: "Audio transcript", text: sample.audio, origin: "paste", adapter: "audio-paste" },
  { label: "Image description", text: sample.image, origin: "paste", adapter: "image-paste" },
];

describe("orchestrator", () => {
  it("rejects empty input", async () => {
    await expect(runPipeline([], { pause: 0 })).rejects.toMatchObject({
      code: "EMPTY_INPUT",
    });
  });

  it("builds a mixed-source revision pack with the local engine", async () => {
    const pack = await runPipeline(mixedSources, {
      engine: "local",
      pause: 0,
      random: () => 0.2,
    });

    expect(pack.sourceCount).toBe(3);
    expect(pack.summary.length).toBeGreaterThanOrEqual(3);
    expect(pack.concepts.length).toBeGreaterThanOrEqual(5);
    // Repeated evidence no longer creates several near-identical questions.
    expect(pack.quiz.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pack.quiz.map(item => item.evidenceId)).size).toBe(pack.quiz.length);
    expect(new Set(pack.quiz.map((item) => item.type)).size).toBeGreaterThan(1);
    expect(pack.checks.groundingCoverage).toBe(100);
    expect(pack.quiz.every((item) => item.evidenceId)).toBe(true);
  });

  it("still runs the original baseline engine", async () => {
    const pack = await runPipeline(mixedSources, {
      engine: "baseline",
      pause: 0,
      random: () => 0.2,
    });

    expect(pack.engine).toBe("baseline");
    expect(pack.quiz.every((item) => ['cloze', 'true-false'].includes(item.type))).toBe(true);
    expect(new Set(pack.quiz.map(item => item.question)).size).toBe(pack.quiz.length);
    expect(pack.checks.groundingCoverage).toBe(100);
  });

  it("handles short input without crashing", async () => {
    const pack = await runPipeline(
      [
        {
          label: "Text notes",
          text: "Source checking helps students review AI output before they trust it.",
          origin: "paste",
          adapter: "text",
        },
      ],
      { engine: "local", pause: 0, random: () => 0.2 }
    );

    expect(pack.summary.length).toBeGreaterThanOrEqual(1);
    expect(pack.concepts.length).toBeGreaterThanOrEqual(1);
    expect(pack.quiz.length).toBeGreaterThanOrEqual(1);
  });
});
