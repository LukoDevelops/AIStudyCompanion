import { applyEmbeddingBoost } from "./embeddings.js";
import { expandQuery } from "./expand.js";
import { extractKeywords, selectKeywords } from "./keywords.js";
import { conceptLimitFor } from "./sections.js";
import { contentTokens, titleCase, tokenize } from "./text.js";

export function findEvidence(corpus, term, provider) {
  const terms = tokenize(term).filter((token) => token.length > 2);
  const expanded = expandQuery(terms, corpus.sentenceRecords, 3);
  const queryTerms = [...new Set([...(terms.length ? terms : contentTokens(term)), ...expanded])];
  const scored = corpus.sentenceRecords.map((record, index) => {
    const haystack = record.sentence.toLowerCase();
    const tokenHits = terms.filter((item) => record.tokens.includes(item)).length;
    const phraseHit = haystack.includes(term.toLowerCase()) ? 2 : 0;

    return {
      record,
      index,
      score: tokenHits + phraseHit,
    };
  });

  const ranked = applyEmbeddingBoost(scored, provider, queryTerms);
  const best = ranked.reduce(
    (winner, item) => (item.score > winner.score ? item : winner),
    ranked[0] || { record: null, index: 0, score: -1 }
  );

  return { record: best.record, overlap: best.score, index: best.index };
}

export function buildConcepts(corpus, keywords = extractKeywords(corpus), options = {}) {
  const { provider = null } = options;
  const limit = options.limit || conceptLimitFor(corpus.sentenceRecords.length);
  const merged = selectKeywords(keywords, limit);

  return merged.map((keyword) => {
    const { record, overlap } = findEvidence(corpus, keyword.term, provider);

    return {
      term: titleCase(keyword.term),
      score: keyword.score,
      evidence: record ? record.sentence : "",
      evidenceId: record ? record.id : "",
      evidenceExcerpt: record ? record.sentence : "",
      source: record ? `${record.source}, sentence ${record.index}` : "No source found",
      section: record?.heading || null,
      overlap,
    };
  });
}
