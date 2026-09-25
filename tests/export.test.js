import { describe, expect, it } from "vitest";
import { toExportablePack } from "../src/export/json.js";
import { toMarkdown } from "../src/export/markdown.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import { sample } from "../src/sample.js";

describe("export", () => {
  it("exports JSON and Markdown with source evidence", async () => {
    const pack = await runPipeline(
      [{ label: "Text notes", text: sample.text, origin: "paste", adapter: "text" }],
      { engine: "local", pause: 0, random: () => 0.2 }
    );

    const json = toExportablePack(pack);
    expect(json.summary[0].text).toBeTruthy();
    expect(json.sentences.length).toBeGreaterThan(0);

    const markdown = toMarkdown(pack);
    expect(markdown).toContain("# AI Study Companion revision pack");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Quiz");
    expect(markdown).toContain(pack.concepts[0].term);
  });
});
