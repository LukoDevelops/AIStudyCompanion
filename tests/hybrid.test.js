import { describe, expect, it } from "vitest";
import { buildBm25Index } from "../src/pipeline/bm25.js";
import { fuseRanks, ranksFromScores } from "../src/pipeline/rrf.js";
import { expandQuery } from "../src/pipeline/expand.js";
import { buildConceptEdges, pageRankScores } from "../src/pipeline/graph.js";
import { buildCoverage } from "../src/pipeline/coverage.js";
import { tokenOverlapStats } from "../src/pipeline/grounding.js";
import { barChartSvg, conceptGraphSvg } from "../src/ui/charts.js";
import { icon } from "../src/ui/icons.js";

describe("hybrid retrieval building blocks", () => {
  it("ranks the BM25 sentence that contains the query term first", () => {
    const index = buildBm25Index([
      { tokens: ["cats", "sleep", "sun"] },
      { tokens: ["retrieval", "ranking", "pipeline"] },
      { tokens: ["students", "notes", "review"] },
    ]);

    expect(index.rank(["retrieval"])[0].index).toBe(1);
  });

  it("gives reciprocal rank fusion the item that is high in both lists", () => {
    const fused = fuseRanks([
      ranksFromScores([0.2, 0.1, 0.9]),
      ranksFromScores([0.3, 0.2, 0.8]),
    ]);

    const winner = [...fused.entries()].sort((left, right) => right[1] - left[1])[0];
    expect(winner[0]).toBe(2);
  });

  it("expands a query with tokens that co-occur at least twice", () => {
    const extra = expandQuery(
      ["retrieval"],
      [
        { tokens: ["retrieval", "grounded", "notes"] },
        { tokens: ["retrieval", "grounded", "quiz"] },
        { tokens: ["cats", "dogs", "park"] },
      ]
    );

    expect(extra).toContain("grounded");
    expect(extra).not.toContain("cats");
  });
});

describe("graph and coverage", () => {
  it("gives a hub node the highest PageRank", () => {
    const ranks = pageRankScores(
      ["Hub", "A", "B", "C"],
      [
        { from: "Hub", to: "A", weight: 1 },
        { from: "Hub", to: "B", weight: 1 },
        { from: "Hub", to: "C", weight: 1 },
      ]
    );

    expect(ranks.Hub).toBeGreaterThan(ranks.A);
    expect(ranks.Hub).toBeGreaterThan(ranks.B);
  });

  it("links concepts that share a source even when their phrases do not overlap", () => {
    const edges = buildConceptEdges([
      { term: "Retrieval Ranking", source: "notes.txt, sentence 1", evidenceId: "a-1" },
      { term: "Quiz Variety", source: "notes.txt, sentence 4", evidenceId: "a-4" },
      { term: "Orphan Idea", source: "other.md, sentence 1", evidenceId: "b-1" },
    ]);

    expect(edges.some((edge) => edge.from === "Retrieval Ranking" && edge.to === "Quiz Variety")).toBe(true);
    expect(edges.some((edge) => edge.from === "Orphan Idea" || edge.to === "Orphan Idea")).toBe(false);
  });

  it("counts unused sentences in coverage", () => {
    const coverage = buildCoverage(
      {
        sentenceRecords: [
          { id: "a-1", source: "Text notes", index: 1, sentence: "Used." },
          { id: "a-2", source: "Text notes", index: 2, sentence: "Unused." },
        ],
      },
      [{ evidenceId: "a-1" }]
    );

    expect(coverage.usedCount).toBe(1);
    expect(coverage.unusedCount).toBe(1);
    expect(coverage.coveragePct).toBe(50);
  });
});

describe("bidirectional grounding and charts", () => {
  it("keeps complete claim overlap at 100% recall", () => {
    const stats = tokenOverlapStats("Source checking helps students", [
      "source",
      "checking",
      "helps",
      "students",
      "review",
    ]);
    expect(stats.recall).toBe(1);
    expect(stats.precision).toBeLessThan(1);
  });

  it("renders accessible coverage bars, SVG graphs and icons", () => {
    expect(barChartSvg([{ label: "Text notes", value: 3 }])).toContain('aria-label="Text notes: 3"');
    expect(conceptGraphSvg([{ term: "Retrieval" }], [])).toContain("Retrieval");
    expect(icon("book")).toContain("viewBox");
  });
});
