import { describe, expect, it } from "vitest";
import { findEvidence } from "../src/pipeline/concepts.js";
import { preprocessSources } from "../src/pipeline/preprocess.js";
import { buildSummary } from "../src/pipeline/summary.js";

function corpusFrom(text) {
  return preprocessSources([
    { label: "Text notes", text, origin: "paste", adapter: "text" },
  ]);
}

describe("retrieval provider", () => {
  it("lets the provider change which sentence is chosen as evidence", () => {
    const corpus = corpusFrom(
      "Cats sleep in the afternoon sun after a long study session. Retrieval ranking should prefer the second sentence here. Dogs chase balls around the park after class."
    );

    const lexical = findEvidence(corpus, "cats");
    expect(lexical.record.sentence.toLowerCase()).toContain("cats");

    const provider = {
      score(index) {
        return index === 1 ? 20 : 0;
      },
    };

    const boosted = findEvidence(corpus, "cats", provider);
    expect(boosted.record.sentence.toLowerCase()).toContain("retrieval ranking");
  });

  it("uses provider relevance when ranking a summary", () => {
    const corpus = corpusFrom(
      "Short note. A second sentence about orchestration pipelines and retrieval ranking. A third extra sentence."
    );
    const provider = {
      relevanceToQuery(index) {
        return index === 1 ? 8 : 0;
      },
      similar() {
        return 0;
      },
    };

    const summary = buildSummary(corpus, [{ term: "note", score: 1 }], {
      provider,
      limit: 1,
    });

    expect(summary[0].text.toLowerCase()).toContain("orchestration");
  });
});
