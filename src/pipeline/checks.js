import { meanGrounding } from "./grounding.js";
import { auditIntegrity } from './integrity.js';

export function buildChecks(corpus, summary, concepts, extras = {}) {
  const quiz = extras.quiz || [];
  const allItems = [...summary, ...concepts, ...quiz];
  const integrity = auditIntegrity(corpus, { summary, concepts, quiz });
  const groundingCoverage = integrity.linkCoverage;
  const meanGroundingScore = meanGrounding(allItems);

  const totalWords = corpus.sentenceRecords.reduce(
    (total, record) => total + record.tokens.length,
    0
  );

  const limitations = [
    "Generated quiz questions should be checked by the learner before use.",
    "Grounding combines token overlap and retrieval similarity. It is not deep semantic fact-checking.",
  ];
  if (integrity.issues.length) limitations.unshift(`${integrity.issues.length} structural quality issue(s) need review. Valid citations alone do not establish factual accuracy.`);
  if (integrity.uncitedSources.length) limitations.unshift(`No output cites these retained sources: ${integrity.uncitedSources.join(', ')}.`);

  if (extras.adapterWarnings?.length) {
    limitations.unshift(...extras.adapterWarnings);
  } else if (!extras.hasRealAdapters) {
    limitations.unshift(
      "Audio and image adapters use pasted text unless a file is uploaded and the local model succeeds."
    );
  }

  if (extras.engine === "baseline") {
    limitations.push(
      "Keyword Scout matches recurring terms to sentences; it does not write new explanations."
    );
  } else if (extras.engine === "semantic") {
    limitations.push(
      "Semantic ranking used a local embedding model. Results can differ from the keyword baseline."
    );
  } else if (extras.engine === "cloud") {
    limitations.push("Study Reasoner uses a cloud language model. Source IDs and quoted text are validated, but this does not establish that every claim is correct. Review the evidence.");
  } else {
    limitations.push(
      "Summary selection uses MMR over hybrid BM25 + TF-IDF retrieval with reciprocal rank fusion. This is not a cloud language model."
    );
  }

  return {
    adapterWarnings: [...(extras.adapterWarnings || [])],
    integrity,
    groundingCoverage,
    meanGroundingScore,
    sourceCount: corpus.sources.length,
    sentenceCount: corpus.sentenceRecords.length,
    estimatedWordCount: totalWords,
    conceptCount: concepts.length,
    engine: extras.engine || "local",
    retrieval: extras.retrieval || "baseline-keywords",
    coveragePct: extras.coverage?.coveragePct ?? 0,
    unusedCount: extras.coverage?.unusedCount ?? 0,
    meanPageRank: extras.meanPageRank || 0,
    prototypeLimitations: limitations,
  };
}
