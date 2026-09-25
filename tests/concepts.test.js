import { describe, expect, it } from "vitest";
import { buildConcepts, findEvidence } from "../src/pipeline/concepts.js";
import { extractKeywords, mergeKeywordDuplicates } from "../src/pipeline/keywords.js";
import { preprocessSources } from "../src/pipeline/preprocess.js";
import { sample } from "../src/sample.js";

function corpusFromSample() {
  return preprocessSources([
    { label: "Text notes", text: sample.text, origin: "paste", adapter: "text" },
    { label: "Audio transcript", text: sample.audio, origin: "paste", adapter: "audio-paste" },
  ]);
}

describe("concept extraction", () => {
  it("merges overlapping keyword phrases", () => {
    const merged = mergeKeywordDuplicates([
      { term: "retrieval", score: 2 },
      { term: "retrieval augmented", score: 3 },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].term).toBe("retrieval augmented");
  });

  it("finds evidence using the full phrase, not only the first word", () => {
    const corpus = corpusFromSample();
    const { record, overlap } = findEvidence(corpus, "source checking");
    expect(record.sentence.toLowerCase()).toContain("source checking");
    expect(overlap).toBeGreaterThan(0);
  });

  it("returns unique concepts with evidence ids", () => {
    const corpus = corpusFromSample();
    const concepts = buildConcepts(corpus, extractKeywords(corpus));
    const terms = concepts.map((item) => item.term.toLowerCase());

    expect(concepts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(terms).size).toBe(terms.length);
    expect(concepts.every((item) => item.evidenceId)).toBe(true);
    expect(terms.some((term) => term.includes("combines"))).toBe(false);
    expect(terms.some((term) => term.includes("instead"))).toBe(false);
    expect(terms.some((term) => term.includes("retrieval"))).toBe(true);
  });
});
