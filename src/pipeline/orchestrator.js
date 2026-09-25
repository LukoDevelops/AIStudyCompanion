import { buildChecks } from "./checks.js";
import { buildConcepts } from "./concepts.js";
import {
  buildConceptsBaseline,
  buildQuizBaseline,
  buildSummaryBaseline,
  extractKeywordsBaseline,
} from "./baseline.js";
import { buildCoverage, groundingHistogram, quizTypeMix } from "./coverage.js";
import { createEmbeddingProvider } from "./embeddings.js";
import { attachRelatedConcepts, buildConceptEdges, meanPageRank } from "./graph.js";
import { attachGrounding } from "./grounding.js";
import { extractKeywords } from "./keywords.js";
import { buildNextSteps } from "./nextSteps.js";
import { preprocessSources } from "./preprocess.js";
import { buildQuiz } from "./quiz.js";
import { buildSummary } from "./summary.js";
import { buildTrace } from "./trace.js";
import { wait } from "./text.js";
import { reasonStudyPack, CLOUD_MODEL } from '../adapters/studyReasoner.js';

function withGrounding({ summary, concepts, quiz }, corpus, provider) {
  return {
    summary: attachGrounding(summary, corpus, provider, (item) => item.text),
    concepts: attachGrounding(
      concepts,
      corpus,
      provider,
      (item) => `${item.term} ${item.evidence}`
    ),
    quiz: attachGrounding(
      quiz,
      corpus,
      provider,
      (item) => `${item.question} ${item.evidenceExcerpt || ""}`
    ),
  };
}

export async function runPipeline(sources, options = {}) {
  const {
    engine = "local",
    onStage = async () => {},
    onStatus = () => {},
    pause = 180,
    collectWarnings: incomingWarnings = [],
  } = options;
  const random = options.random || Math.random;
  const collectWarnings = [...incomingWarnings];
  if (!['baseline', 'local', 'semantic', 'cloud'].includes(engine)) {
    throw new Error('Unknown generation engine. Choose one of the listed options.');
  }

  await onStage("inputs");

  if (!sources.length) {
    const error = new Error(
      "Add at least one piece of study material before building a revision pack."
    );
    error.code = "EMPTY_INPUT";
    throw error;
  }

  await wait(pause);
  await onStage("preprocess");
  const corpus = preprocessSources(sources);

  if (!corpus.sentenceRecords.length) {
    const error = new Error(
      "There was not enough text to work with. Add a few full sentences and try again."
    );
    error.code = "SHORT_INPUT";
    throw error;
  }

  await wait(pause);
  await onStage("retrieve");

  let keywords;
  let concepts;
  let summary;
  let quiz;
  let provider = null;
  let usedSemantic = false;

  if (engine === "baseline") {
    keywords = extractKeywordsBaseline(corpus);
    concepts = buildConceptsBaseline(corpus, keywords);
    await wait(pause);
    await onStage("generate");
    summary = buildSummaryBaseline(corpus, keywords);
    quiz = buildQuizBaseline(concepts, random);
  } else {
    keywords = extractKeywords(corpus);
    provider = await createEmbeddingProvider(corpus.sentenceRecords, {
      semantic: engine === "semantic",
      onStatus,
    });
    usedSemantic = String(provider.name || "").includes("minilm");
    onStatus(`Search is ready: ${provider.name}. Passages are ranked with BM25, TF-IDF, and reciprocal rank fusion.`);
    concepts = buildConcepts(corpus, keywords, { provider });
    await wait(pause);
    await onStage("generate");
    summary = buildSummary(corpus, keywords, { provider });
    quiz = buildQuiz(concepts, corpus, {
      random,
      provider,
      limit: Math.max(5, Math.min(10, Math.round(concepts.length * 0.7))),
    });
  }

  if (engine === 'cloud') {
    const generated = await reasonStudyPack(corpus, options.cloudKey, onStatus);
    summary = generated.summary;
    quiz = generated.quiz;
    collectWarnings.push(`Study Reasoner (${CLOUD_MODEL}) used ${generated.evidenceCount} selected passages. Citations were checked against the source text, but that does not verify every generated claim.`);
  }
  concepts = attachRelatedConcepts(concepts);
  const grounded = withGrounding({ summary, concepts, quiz }, corpus, provider);
  summary = grounded.summary;
  concepts = grounded.concepts;
  quiz = grounded.quiz;

  await wait(pause);
  await onStage("check");

  const adapterWarnings = [
    ...new Set([...sources.map((source) => source.warning), ...collectWarnings].filter(Boolean)),
  ];
  const realOrigins = new Set(["whisper", "ocr", "pdf", "docx", "vision", "cloud-vision"]);
  const hasRealAdapters = sources.some((source) => realOrigins.has(source.origin));

  if (corpus.truncated) {
    adapterWarnings.push(
      `${corpus.sentenceRecords.length} sentences were sampled across the sources to keep processing manageable. Some passages were not included.`
    );
  }

  const resolvedEngine = engine === 'semantic' && !usedSemantic ? 'local' : engine;

  const coverage = buildCoverage(corpus, [...summary, ...concepts, ...quiz]);
  const graphEdges = buildConceptEdges(concepts);
  const nextSteps = buildNextSteps(corpus, concepts, {
    engine: resolvedEngine,
    usedFallback: adapterWarnings.some(warning => /failed|could not|unavailable|fallback/i.test(warning)),
    unusedCount: coverage.unusedCount,
  });
  const checks = buildChecks(corpus, summary, concepts, {
    engine: resolvedEngine,
    adapterWarnings,
    hasRealAdapters,
    quiz,
    coverage,
    retrieval: provider?.name || "baseline-keywords",
    meanPageRank: meanPageRank(concepts),
  });
  const analytics = {
    coverage,
    graphEdges,
    groundingBins: groundingHistogram([...summary, ...concepts, ...quiz]),
    quizTypes: quizTypeMix(quiz),
    retrieval: provider?.name || "baseline-keywords",
    meanPageRank: meanPageRank(concepts),
  };
  const trace = buildTrace({
    sources,
    corpus,
    provider,
    engine: resolvedEngine,
    keywords,
    coverage,
  });

  return {
    generatedAt: new Date().toISOString(),
    engine: resolvedEngine,
    retrieval: provider?.name || "baseline-keywords",
    sourceCount: sources.length,
    sources: sources.map((source) => ({
      label: source.label,
      origin: source.origin,
      adapter: source.adapter,
      warning: source.warning || null,
    })),
    corpus,
    sections: corpus.sections || [],
    keywords,
    summary,
    concepts,
    quiz,
    nextSteps,
    checks,
    analytics,
    trace,
  };
}
