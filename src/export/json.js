import { downloadBlob } from './download.js';

export function toExportablePack(result) {
  return {
    generatedAt: result.generatedAt,
    engine: result.engine,
    sourceCount: result.sourceCount,
    sources: result.sources,
    summary: result.summary,
    concepts: result.concepts,
    quiz: result.quiz,
    nextSteps: result.nextSteps,
    checks: result.checks,
    retrieval: result.retrieval,
    analytics: result.analytics,
    trace: result.trace,
    sentences: result.corpus.sentenceRecords.map((record) => ({
      id: record.id,
      source: record.source,
      index: record.index,
      sentence: record.sentence,
    })),
  };
}

export function downloadJson(result, filename = "ai-study-companion-revision-pack.json") {
  const blob = new Blob([JSON.stringify(toExportablePack(result), null, 2)], {
    type: "application/json",
  });

  downloadBlob(blob, filename);
}
