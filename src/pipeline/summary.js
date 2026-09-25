import { expandQuery } from "./expand.js";
import { selectMmr } from "./mmr.js";
import {
  allocateBudgets,
  groupRecordsBySection,
  shouldUseSections,
  summaryLimitFor,
} from "./sections.js";
import { contentTokens } from "./text.js";
import { studyValue } from './studyQuality.js';

function confidenceLabel(score) {
  if (score > 3) {
    return "High";
  }

  if (score > 1) {
    return "Medium";
  }

  return "Low";
}

const sentenceKey = item => item.record.sentence.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function uniqueCandidates(items, seen = new Set()) {
  return items.filter(item => { const key=sentenceKey(item); if(seen.has(key)) return false; seen.add(key); return true; });
}

function scoreCandidates(records, keywordSet, keywordTerms, provider) {
  return records.filter(({record}) => studyValue(record) > -5).map(({ record, originalIndex }) => {
    const keywordHits = record.tokens.filter((token) => keywordSet.has(token)).length;
    const lengthScore = record.tokens.length >= 8 && record.tokens.length <= 32 ? 1 : 0.6;
    const sourceBoost = record.origin === "paste" ? 1.05 : 1;
    const kindBoost = record.kind === "bullet" ? 0.92 : 1;
    const retrieval = provider
      ? provider.relevanceToQuery(
          originalIndex,
          keywordTerms.length ? keywordTerms : record.tokens
        )
      : 0;

    return {
      record,
      originalIndex,
      relevance:
        keywordHits * lengthScore * sourceBoost * kindBoost + retrieval * 2.4 + studyValue(record) * 2,
    };
  });
}

function similarityFor(provider) {
  return (left, right) => {
    if (provider) {
      return provider.similar(left.originalIndex, right.originalIndex);
    }

    const leftSet = new Set(left.record.tokens);
    const shared = right.record.tokens.filter((token) => leftSet.has(token)).length;
    return shared / Math.max(left.record.tokens.length, right.record.tokens.length, 1);
  };
}

function toSummaryItem(item) {
  return {
    text: item.record.sentence,
    source: `${item.record.source}, sentence ${item.record.index}`,
    section: item.record.heading || null,
    evidenceId: item.record.id,
    evidenceExcerpt: item.record.sentence,
    confidence: confidenceLabel(item.relevance),
    origin: item.record.origin,
    score: Number(item.relevance.toFixed(2)),
    tokens: contentTokens(item.record.sentence),
  };
}

export function buildSummary(corpus, keywords, options = {}) {
  const { provider = null } = options;
  const sourceCount = new Set(corpus.sentenceRecords.map(record => record.source)).size;
  const limit = options.limit ?? Math.max(sourceCount, summaryLimitFor(corpus.sentenceRecords.length));
  const seedTerms = keywords.slice(0, 10).flatMap((item) => item.term.split(" "));
  const keywordTerms = [
    ...seedTerms,
    ...expandQuery(seedTerms, corpus.sentenceRecords, 4),
  ];
  const keywordSet = new Set(keywordTerms);
  const similarity = similarityFor(provider);

  if (new Set(corpus.sentenceRecords.map(record => record.source)).size > 1) {
    const indexed = corpus.sentenceRecords.map((record, originalIndex) => ({record, originalIndex}));
    const candidates = scoreCandidates(indexed, keywordSet, keywordTerms, provider);
    const bySource = new Map();
    candidates.forEach(candidate => {
      const source = candidate.record.source;
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source).push(candidate);
    });
    const picked = [], seen = new Set();
    for (const group of bySource.values()) {
      if (picked.length >= limit) break;
      // When a diagram supplies readable labels, prefer them to descriptions
      // of its background, border or screenshot layout.
      const ocr = group.filter(item => item.record.origin === 'ocr' && item.record.tokens.length >= 3);
      const pool = (ocr.length >= 2 ? ocr : group).filter(item => !seen.has(sentenceKey(item)));
      const choice = selectMmr(pool, {limit:1, similarity, initial:picked})[0];
      if (choice) { picked.push(choice); seen.add(sentenceKey(choice)); }
    }
    const ids = new Set(picked.map(item => item.record.id));
    if (picked.length < limit) picked.push(...selectMmr(uniqueCandidates(candidates.filter(item => !ids.has(item.record.id)), seen), {limit:limit-picked.length, similarity, initial:picked}));
    return picked.sort((a,b)=>a.originalIndex-b.originalIndex).map(toSummaryItem);
  }

  if (!shouldUseSections(corpus) && corpus.sources.length < 2) {
    const indexed = corpus.sentenceRecords.map((record, originalIndex) => ({
      record,
      originalIndex,
    }));
    const candidates = uniqueCandidates(scoreCandidates(indexed, keywordSet, keywordTerms, provider));
    const selected = selectMmr(candidates, {
      limit: Math.min(limit, candidates.length),
      similarity,
    });

    return selected
      .sort((left, right) => left.originalIndex - right.originalIndex)
      .map(toSummaryItem);
  }

  const groups = groupRecordsBySection(corpus);
  const budgets = allocateBudgets(corpus.sections, limit);
  const picked = [];

  corpus.sections.forEach((section) => {
    const budget = budgets.get(section.key) || 0;
    const records = groups.get(section.key) || [];

    if (!budget || !records.length) {
      return;
    }

    const candidates = uniqueCandidates(scoreCandidates(records, keywordSet, keywordTerms, provider), new Set(picked.map(sentenceKey)));
    picked.push(
      ...selectMmr(candidates, {
        limit: Math.min(budget, candidates.length),
        similarity,
      })
    );
  });

  return picked
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map(toSummaryItem);
}
