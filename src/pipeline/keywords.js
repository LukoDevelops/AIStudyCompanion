import { stopWords, weakConceptWords, tokenize } from "./text.js";
import { studyValue } from './studyQuality.js';

const weakLoneTerms = new Set([
  "notes",
  "model",
  "source",
  "students",
  "system",
  "content",
  "diagram",
  "speaker",
  "lecture",
  "material",
  "formats",
  "inputs",
  "output",
  "stage",
]);

const weakGlueWords = new Set([
  "rather", "once", "collect", "collected", "also", "usually", "several", "single",
  "combines",
  "combine",
  "explained",
  "shows",
  "show",
  "manage",
  "written",
  "recorded",
  "technique",
  "types",
  "instead",
  "relying",
  "retrieves",
  "retrieve",
  "uses",
  "internal",
  "relevant",
  "accepting",
  "extracted",
]);

function isUsefulTerm(term) {
  const words = term.split(" ");

  if (term.length <= 3) {
    return false;
  }

  // OCR and transcripts repeat themselves, which produced concepts like "pros pros".
  if (words.length === 2 && words[0] === words[1]) {
    return false;
  }

  if (words.some((word) => /^\d+$/.test(word) || !/[aeiouy]/i.test(word))) {
    return false;
  }

  if (
    words.some(
      (word) =>
        stopWords.has(word) ||
        weakGlueWords.has(word) ||
        weakConceptWords.has(word)
    )
  ) {
    return false;
  }

  if (words.length === 1 && weakLoneTerms.has(words[0])) {
    return false;
  }

  return true;
}

export function extractKeywords(corpus) {
  const scores = new Map();

  const add = (term, amount) => {
    scores.set(term, (scores.get(term) || 0) + amount);
  };

  corpus.sentenceRecords.forEach((record, sentenceIndex) => {
    if (studyValue(record) <= -5) return;
    const positionBoost = sentenceIndex < 3 ? 1.15 : 1;

    record.tokens.forEach((token) => {
      add(token, positionBoost);
    });

    // Keep original word positions when forming phrases.
    const originalTokens = tokenize(record.sentence);
    for (let i = 0; i < originalTokens.length - 1; i += 1) {
      const phrase = `${originalTokens[i]} ${originalTokens[i + 1]}`;
      add(phrase, 1.7 * positionBoost);
    }
  });

  return [...scores.entries()]
    .filter(([term]) => isUsefulTerm(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term, score]) => ({
      term,
      score: Number(score.toFixed(2)),
    }));
}

export function mergeKeywordDuplicates(keywords) {
  const kept = [];

  for (const keyword of keywords) {
    const overlap = kept.findIndex((existing) => {
      return (
        existing.term.includes(keyword.term) ||
        keyword.term.includes(existing.term)
      );
    });

    if (overlap === -1) {
      kept.push(keyword);
      continue;
    }

    const current = kept[overlap];
    const preferNew =
      keyword.term.split(" ").length > current.term.split(" ").length ||
      keyword.score > current.score + 0.4;

    if (preferNew) {
      kept[overlap] = {
        term:
          keyword.term.split(" ").length >= current.term.split(" ").length
            ? keyword.term
            : current.term,
        score: Math.max(keyword.score, current.score),
      };
    }
  }

  return kept;
}

export function selectKeywords(keywords, limit = 8) {
  const selected = [];
  const used = new Set();

  for (const keyword of mergeKeywordDuplicates(keywords)) {
    const words = keyword.term.split(" ");
    const shared = words.filter((word) => used.has(word)).length;

    if (shared > 0) {
      continue;
    }

    selected.push(keyword);
    words.forEach((word) => used.add(word));

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}
