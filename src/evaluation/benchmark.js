import { runPipeline } from '../pipeline/orchestrator.js';

const source = (label, text, adapter = 'text') => ({label, text, adapter, origin:'paste'});
export const benchmarkCases = [
  {id:'definitions', sources:[source('Biology', 'Photosynthesis is the process by which plants convert light energy into chemical energy. Chlorophyll is the pigment that absorbs light in plant cells. Respiration is the process that releases energy from glucose. Stomata are openings that regulate gas exchange in leaves.')], concepts:['photosynthesis','chlorophyll','respiration','stomata']},
  {id:'mixed-sources', sources:[
    source('Reading', 'Retrieval ranks passages by relevance to a query. Indexing creates a searchable representation of documents. A baseline provides a reference for comparing improvements.'),
    source('Meeting transcript', 'Precision measures the proportion of retrieved results that are relevant. Recall measures the proportion of relevant results that are retrieved.', 'audio-paste'),
    source('Diagram description', 'The diagram shows a query entering a retrieval system. Retrieved passages are passed to a generator, and citations connect answers to evidence.', 'image-paste'),
  ], concepts:['retrieval','precision','recall','citations']},
  {id:'negation-and-numbers', sources:[source('Experiment', 'The experiment included twenty participants in two groups. The intervention did not improve recall in the control group. The treatment group completed twelve tasks. These observations do not establish that the intervention caused an improvement.')], concepts:['participants','recall','control','treatment']},
  {id:'imbalanced-inputs', sources:[source('Long reading', Array.from({length:100}, (_,i) => `Experiment ${i + 1} measured retrieval precision using indexed scientific documents.`).join(' ')), source('Short transcript', 'Privacy requires consent before sharing personal study materials with a cloud service.', 'audio-paste')], concepts:['retrieval','privacy','consent']},
  {id:'single-sentence', sources:[source('Short note', 'Source checking helps students review generated claims before trusting a revision pack.')], concepts:['source','claims']},
];

export function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

export function scoreBenchmark(pack, fixture) {
  const text = [...pack.summary.map(item => item.text), ...pack.concepts.map(item => item.term)].join(' ').toLowerCase();
  const matched = fixture.concepts.filter(term => text.includes(term.toLowerCase()));
  return {
    integrity: pack.checks.integrity,
    expectedTermRecall: matched.length / fixture.concepts.length,
    missedTerms: fixture.concepts.filter(term => !matched.includes(term)),
    summaryCount: pack.summary.length, quizCount: pack.quiz.length,
    summarySourceCount: new Set(pack.summary.map(item => pack.corpus.sentenceRecords.find(record => record.id === item.evidenceId)?.source).filter(Boolean)).size,
  };
}

export async function runBenchmark({ engines = ['baseline', 'local'], cases = benchmarkCases, repetitions = 3 } = {}) {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) throw new Error('Use 1–20 repetitions.');
  if (engines.some(engine => !['baseline','local'].includes(engine))) throw new Error('This offline benchmark supports baseline and local engines only.');
  const rows = [];
  for (const fixture of cases) {
    for (let repetition = 0; repetition < repetitions; repetition++) {
      const order = repetition % 2 ? [...engines].reverse() : engines;
      for (const engine of order) {
        const start = performance.now();
        try {
          const pack = await runPipeline(fixture.sources, {engine, pause:0, random:seededRandom(42 + repetition)});
          rows.push({caseId:fixture.id, engine, repetition, durationMs:Math.round(performance.now() - start), ...scoreBenchmark(pack, fixture)});
        } catch (error) {
          rows.push({caseId:fixture.id, engine, repetition, error:String(error.message)});
        }
      }
    }
  }
  return {version:1, generatedAt:new Date().toISOString(), caveat:'Synthetic offline pipeline checks. Term recall is lexical, not factual accuracy. No real file decoding, model inference, human ratings or learning outcomes are measured.', rows};
}
