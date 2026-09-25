import { runPipeline } from "../pipeline/orchestrator.js";
import { evaluationFixtures, evaluatePack } from "./fixtures.js";

export async function runEvaluationFixtures(engine = "local") {
  const rows = [];

  for (const fixture of evaluationFixtures) {
    const sources = [
      fixture.inputs.notes && {
        label: "Text notes",
        text: fixture.inputs.notes,
        origin: "paste",
        adapter: "text",
      },
      fixture.inputs.transcript && {
        label: "Audio transcript",
        text: fixture.inputs.transcript,
        origin: "paste",
        adapter: "audio-paste",
      },
      fixture.inputs.description && {
        label: "Image description",
        text: fixture.inputs.description,
        origin: "paste",
        adapter: "image-paste",
      },
    ].filter(Boolean);

    const pack = await runPipeline(sources, {
      engine,
      pause: 0,
      random: () => 0.3,
    });
    const verdict = evaluatePack(pack, fixture.expect);

    rows.push({
      id: fixture.id,
      name: fixture.name,
      engine,
      passed: verdict.passed,
      failures: verdict.failures,
      summaryCount: pack.summary.length,
      conceptCount: pack.concepts.length,
      quizCount: pack.quiz.length,
      groundingCoverage: pack.checks.groundingCoverage,
    });
  }

  return rows;
}
