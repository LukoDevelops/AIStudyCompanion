import { describe, expect, it } from "vitest";
import { scoreQuiz } from "../src/pipeline/quiz.js";

describe("quiz scoring", () => {
  it("counts correct answers only", () => {
    const quiz = [
      { answer: "Language Model" },
      { answer: "True" },
    ];

    expect(scoreQuiz(quiz, ["Language Model", "False"])).toEqual({
      correct: 1,
      total: 2,
      details: [
        { given: "Language Model", correct: true, answer: "Language Model" },
        { given: "False", correct: false, answer: "True" },
      ],
    });
  });
});
