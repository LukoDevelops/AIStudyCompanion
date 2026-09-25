import { sample } from "../sample.js";

export const evaluationFixtures = [
  {
    id: "sample-text-only",
    name: "Sample text only",
    inputs: {
      notes: sample.text,
      transcript: "",
      description: "",
    },
    expect: {
      minSources: 1,
      minConcepts: 3,
      minSummary: 2,
      minQuiz: 2,
      grounding: 100,
    },
  },
  {
    id: "mixed-sample",
    name: "Mixed sample inputs",
    inputs: {
      notes: sample.text,
      transcript: sample.audio,
      description: sample.image,
    },
    expect: {
      minSources: 3,
      minConcepts: 5,
      minSummary: 3,
      minQuiz: 3,
      grounding: 100,
    },
  },
  {
    id: "short-input",
    name: "Short input",
    inputs: {
      notes: "Source checking helps students review AI output before they trust it.",
      transcript: "",
      description: "",
    },
    expect: {
      minSources: 1,
      minConcepts: 1,
      minSummary: 1,
      minQuiz: 1,
      grounding: 100,
    },
  },
];

export function evaluatePack(result, expect) {
  const failures = [];

  if (result.sourceCount < expect.minSources) {
    failures.push(`expected at least ${expect.minSources} sources`);
  }

  if (result.concepts.length < expect.minConcepts) {
    failures.push(`expected at least ${expect.minConcepts} concepts`);
  }

  if (result.summary.length < expect.minSummary) {
    failures.push(`expected at least ${expect.minSummary} summary points`);
  }

  if (result.quiz.length < expect.minQuiz) {
    failures.push(`expected at least ${expect.minQuiz} quiz questions`);
  }

  if (result.checks.groundingCoverage < expect.grounding) {
    failures.push(`expected grounding coverage of ${expect.grounding}%`);
  }

  const ungrounded = [
    ...result.summary.filter((item) => !item.evidenceId),
    ...result.concepts.filter((item) => !item.evidenceId),
    ...result.quiz.filter((item) => !item.evidenceId),
  ];

  if (ungrounded.length) {
    failures.push("expected every output item to include an evidence id");
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
