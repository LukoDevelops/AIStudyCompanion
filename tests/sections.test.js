import { describe, expect, it } from "vitest";
import {
  allocateBudgets,
  conceptLimitFor,
  shouldUseSections,
  summaryLimitFor,
} from "../src/pipeline/sections.js";
import { normaliseDocument } from "../src/pipeline/document.js";
import { preprocessSources } from "../src/pipeline/preprocess.js";
import { extractKeywords } from "../src/pipeline/keywords.js";
import { buildSummary } from "../src/pipeline/summary.js";

function longReportSource() {
  const chapters = [
    ["Introduction", "orchestration", "study material", "revision pack"],
    ["Literature Review", "retrieval augmented generation", "grounding", "evaluation"],
    ["Design", "adapters", "sentence store", "controller"],
    ["Implementation", "hybrid retrieval", "maximal marginal relevance", "page rank"],
    ["Evaluation", "coverage", "fixtures", "peer testing"],
  ];

  const lines = [];

  chapters.forEach(([heading, ...topics]) => {
    lines.push(`Chapter ${chapters.indexOf(chapters.find((c) => c[0] === heading)) + 1} - ${heading}`);

    topics.forEach((topic) => {
      for (let index = 0; index < 3; index += 1) {
        lines.push(
          `The ${heading.toLowerCase()} section explains how ${topic} supports the workflow in situation number ${index + 1} for students.`
        );
      }
    });
  });

  const document = normaliseDocument({ text: lines.join("\n") });

  return {
    label: "Draft report",
    text: document.text,
    origin: "pdf",
    adapter: "text",
    blocks: document.blocks,
  };
}

describe("section budgets", () => {
  it('respects the total budget even with one huge section and many tiny sections', () => {
    const sections = [1000,1,1,1,1,1].map((size,index) => ({key:String(index),sentenceIds:Array(size)}));
    const budgets = allocateBudgets(sections, 7);
    expect([...budgets.values()].reduce((a,b)=>a+b,0)).toBe(7);
    expect([...budgets.values()].every(value => value >= 1)).toBe(true);
  });
  it('preserves allocation invariants across varied sizes and budgets', () => {
    for (let count=1; count<=20; count++) for(let budget=0;budget<=30;budget++) {
      const sections = Array.from({length:count},(_,i)=>({key:String(i),sentenceIds:Array((i * 7 + count) % 23 + 1)}));
      const allocations = allocateBudgets(sections,budget);
      const total = [...allocations.values()].reduce((a,b)=>a+b,0);
      expect(total).toBe(Math.min(budget,sections.reduce((sum,s)=>sum+s.sentenceIds.length,0)));
      sections.forEach(s=>expect(allocations.get(s.key) || 0).toBeLessThanOrEqual(s.sentenceIds.length));
    }
  });
  it("scales the summary length with the size of the document", () => {
    expect(summaryLimitFor(8)).toBeLessThanOrEqual(4);
    expect(summaryLimitFor(400)).toBeGreaterThan(summaryLimitFor(40));
    expect(summaryLimitFor(5000)).toBeLessThanOrEqual(14);
    expect(conceptLimitFor(400)).toBeGreaterThan(conceptLimitFor(10));
  });

  it("gives every section at least one point and shares out the rest", () => {
    const budgets = allocateBudgets(
      [
        { key: "a", sentenceIds: Array.from({ length: 40 }) },
        { key: "b", sentenceIds: Array.from({ length: 8 }) },
        { key: "c", sentenceIds: Array.from({ length: 2 }) },
      ],
      10
    );

    expect(budgets.get("a")).toBeGreaterThan(budgets.get("b"));
    expect(budgets.get("c")).toBeGreaterThanOrEqual(1);
    expect([...budgets.values()].reduce((total, value) => total + value, 0)).toBe(10);
  });

  it("never allocates more points than a section has sentences", () => {
    const budgets = allocateBudgets(
      [
        { key: "a", sentenceIds: Array.from({ length: 1 }) },
        { key: "b", sentenceIds: Array.from({ length: 1 }) },
      ],
      8
    );

    expect(budgets.get("a")).toBe(1);
    expect(budgets.get("b")).toBe(1);
  });
});

describe("long documents", () => {
  it('does not silently omit later sources from a many-source summary', () => {
    const sources = Array.from({length:16},(_,i)=>({label:`Source ${i}`,text:`Experiment number ${i} measures retrieval accuracy using scientific documents and relevant source passages.`}));
    const corpus = preprocessSources(sources);
    const summary = buildSummary(corpus,extractKeywords(corpus));
    expect(new Set(summary.map(item=>item.source)).size).toBe(16);
    expect(buildSummary(corpus,extractKeywords(corpus),{limit:3})).toHaveLength(3);
  });
  it("spreads the summary across chapters instead of one region", () => {
    const corpus = preprocessSources([longReportSource()]);

    expect(corpus.sentenceRecords.length).toBeGreaterThan(40);
    expect(shouldUseSections(corpus)).toBe(true);

    const summary = buildSummary(corpus, extractKeywords(corpus));
    const sections = new Set(summary.map((item) => item.section));

    expect(summary.length).toBeGreaterThan(4);
    expect(sections.size).toBeGreaterThanOrEqual(4);
  });

  it("keeps short notes on the simple global path", () => {
    const corpus = preprocessSources([
      {
        label: "Text notes",
        text: "Retrieval augmented generation uses an external source of information. Students still need to check unsupported claims before revising.",
        origin: "paste",
        adapter: "text",
      },
    ]);

    expect(shouldUseSections(corpus)).toBe(false);
    expect(buildSummary(corpus, extractKeywords(corpus)).length).toBeGreaterThanOrEqual(1);
  });
});
