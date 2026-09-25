import { runPipeline } from "./orchestrator.js";

export function packMetrics(pack) {
  const terms = pack.concepts.map((item) => item.term.toLowerCase());
  const duplicatePhrases = terms.filter((term, index) =>
    terms.some((other, otherIndex) => otherIndex !== index && (other.includes(term) || term.includes(other)))
  ).length;

  return {
    engine: pack.engine,
    conceptCount: pack.concepts.length,
    summaryCount: pack.summary.length,
    quizCount: pack.quiz.length,
    quizTypes: new Set(pack.quiz.map((item) => item.type)).size,
    meanGrounding: pack.checks.meanGroundingScore || 0,
    linkCoverage: pack.checks.groundingCoverage,
    coveragePct: pack.checks.coveragePct || 0,
    retrieval: pack.retrieval || pack.checks.retrieval || pack.engine,
    duplicatePhrases,
    structuralIssues: pack.checks.integrity?.issues.length ?? null,
    sourceRepresentationPct: pack.checks.integrity?.sourceRepresentationPct ?? null,
    quoteMatchPct: pack.checks.integrity?.quoteMatchPct ?? null,
  };
}

export async function compareEngines(sources, options = {}) {
  const shared = {
    pause: 0,
    random: options.random || (() => 0.25),
    onStatus: options.onStatus || (() => {}),
    onStage: options.onStage || (() => {}),
    collectWarnings: options.collectWarnings || [],
  };

  const start = performance.now();
  const baseline = await runPipeline(sources, { ...shared, engine: "baseline" });
  const baselineMs = performance.now() - start;
  const localStart = performance.now();
  const local = await runPipeline(sources, { ...shared, engine: options.improvedEngine || "local" });
  const localMs = performance.now() - localStart;

  return {
    baseline: {...packMetrics(baseline), durationMs:Math.round(baselineMs)},
    local: {...packMetrics(local), durationMs:Math.round(localMs)},
    packs: { baseline, local },
  };
}
