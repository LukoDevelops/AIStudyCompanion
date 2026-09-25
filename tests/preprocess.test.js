import { describe, expect, it } from "vitest";
import { preprocessSources } from "../src/pipeline/preprocess.js";

describe("preprocessSources", () => {
  it('shares a capped budget with later audio and image sources and retains conclusions', () => {
    const corpus = preprocessSources([
      {label:'Paper',text:Array.from({length:2000},(_,i)=>`Research observation number ${i} explains important memory mechanisms.`).join(' ')},
      {label:'Recording',adapter:'whisper',text:'The lecturer explains how sleep helps consolidate memories.'},
      {label:'Image',adapter:'vision',text:'The diagram connects sleeping patterns with memory consolidation.'},
    ], {maxSentences:20});
    expect(corpus.sentenceRecords).toHaveLength(20);
    expect(new Set(corpus.sentenceRecords.slice(0,3).map(record=>record.source)).size).toBe(3);
    expect(corpus.sentenceRecords.some(record=>record.id==='Paper-2000')).toBe(true);
    expect(corpus.truncated).toBe(true);
    expect(corpus.sections.flatMap(section=>section.sentenceIds)).toHaveLength(20);
  });
  it("builds source-aware sentence records", () => {
    const corpus = preprocessSources([
      {
        label: "Text notes",
        text: "Retrieval augmented generation uses an external source of information. Students still need to check unsupported claims before they revise.",
        origin: "paste",
        adapter: "text",
      },
    ]);

    expect(corpus.sentenceRecords.length).toBeGreaterThanOrEqual(2);
    expect(corpus.sentenceRecords[0].id).toBe("Text notes-1");
    expect(corpus.sentenceRecords[0].tokens.length).toBeGreaterThan(0);
  });

  it("ignores empty sources", () => {
    const corpus = preprocessSources([]);
    expect(corpus.sentenceRecords).toEqual([]);
  });
});
