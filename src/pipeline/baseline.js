import { stopWords, titleCase, tokenize, truncate, shuffle } from "./text.js";
import { randomizeQuizChoiceOrder } from "./quiz.js";

export function extractKeywordsBaseline(corpus) {
  const scores = new Map();

  const add = (term, amount) => {
    scores.set(term, (scores.get(term) || 0) + amount);
  };

  corpus.sentenceRecords.forEach((record, sentenceIndex) => {
    const positionBoost = sentenceIndex < 3 ? 1.15 : 1;

    record.tokens.forEach((token) => {
      add(token, positionBoost);
    });

    for (let i = 0; i < record.tokens.length - 1; i += 1) {
      const phrase = `${record.tokens[i]} ${record.tokens[i + 1]}`;

      if (!phrase.split(" ").some((word) => stopWords.has(word))) {
        add(phrase, 1.7 * positionBoost);
      }
    }
  });

  return [...scores.entries()]
    .filter(([term]) => term.length > 3)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 14)
    .map(([term, score]) => ({
      term,
      score: Number(score.toFixed(2)),
    }));
}

export function buildConceptsBaseline(corpus, keywords) {
  return keywords.slice(0, 8).map((keyword) => {
    const evidence =
      corpus.sentenceRecords.find((record) =>
        record.sentence.toLowerCase().includes(keyword.term.split(" ")[0])
      ) || corpus.sentenceRecords[0];

    return {
      term: titleCase(keyword.term),
      score: keyword.score,
      evidence: evidence ? evidence.sentence : "",
      evidenceId: evidence ? evidence.id : "",
      evidenceExcerpt: evidence ? evidence.sentence : "",
      source: evidence
        ? `${evidence.source}, sentence ${evidence.index}`
        : "No source found",
    };
  });
}

export function buildSummaryBaseline(corpus, keywords) {
  const keywordSet = new Set(
    keywords.slice(0, 10).flatMap((item) => item.term.split(" "))
  );

  const scored = corpus.sentenceRecords.map((record, originalIndex) => {
    const keywordHits = record.tokens.filter((token) =>
      keywordSet.has(token)
    ).length;
    const lengthScore =
      record.tokens.length >= 8 && record.tokens.length <= 28 ? 1 : 0.6;
    const sourceBoost = record.source === "Text notes" ? 1.1 : 1;

    return {
      ...record,
      score: keywordHits * lengthScore * sourceBoost,
      originalIndex,
    };
  });

  const ranked = scored.sort((left, right) => right.score - left.score);
  const representatives = new Map();
  const sentences = new Set();
  const signature = record => record.sentence.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  ranked.forEach(record => {
    const key = signature(record);
    if (!representatives.has(record.source) && !sentences.has(key)) {
      representatives.set(record.source, record); sentences.add(key);
    }
  });
  const selected = [...representatives.values()];
  const ids = new Set(selected.map(record => record.id));
  for (const record of ranked) {
    if (selected.length >= Math.max(4, representatives.size)) break;
    if (!ids.has(record.id) && !sentences.has(signature(record))) {
      selected.push(record); ids.add(record.id); sentences.add(signature(record));
    }
  }
  return selected
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map((record) => ({
      text: record.sentence,
      source: `${record.source}, sentence ${record.index}`,
      evidenceId: record.id,
      evidenceExcerpt: record.sentence,
      confidence:
        record.score > 3 ? "High" : record.score > 1 ? "Medium" : "Low",
    }));
}

export function buildQuizBaseline(concepts, random = Math.random) {
  const distractors = concepts.map((concept) => concept.term);
  const seenTerms = new Set();
  const candidates = concepts.filter(concept => {
    if (seenTerms.has(concept.term.toLowerCase())) return false;
    seenTerms.add(concept.term.toLowerCase());
    return true;
  });
  return randomizeQuizChoiceOrder(candidates.map((concept) => {
    const pattern = new RegExp(concept.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const canBlank = pattern.test(concept.evidence) && new Set(distractors).size >= 2;
    const evidence = canBlank ? concept.evidence.replace(pattern, '______') : concept.evidence;
    const choices = shuffle(
      [
        concept.term,
        ...distractors.filter((item) => item !== concept.term).slice(0, 3),
      ],
      random
    );

    return {
      type: canBlank ? 'cloze' : 'true-false',
      question: canBlank ? `Fill in the missing phrase: “${evidence}”` : `True or false: the supplied material includes this statement: “${evidence}”`,
      choices: canBlank ? choices : ['True', 'False'],
      answer: canBlank ? concept.term : 'True',
      source: concept.source,
      evidenceId: concept.evidenceId,
      evidenceExcerpt: concept.evidence,
      explanation: `The source statement contains evidence related to ${concept.term}.`,
    };
  }).filter((item, index, items) => items.findIndex(other => other.question === item.question) === index).slice(0, 5), random);
}

export function tokenizeBaseline(text) {
  return tokenize(text);
}
