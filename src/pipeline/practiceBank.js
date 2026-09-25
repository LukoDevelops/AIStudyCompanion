import { buildBm25Index } from './bm25.js';
import { buildCoverage } from './coverage.js';
import { attachRelatedConcepts } from './graph.js';
import { selectMmr } from './mmr.js';
import { studyValue } from './studyQuality.js';
import { contentTokens, shuffle, titleCase, truncate } from './text.js';
import { randomizeQuizChoiceOrder } from './quiz.js';

export function sourceName(item) {
  return String(item?.source || '').replace(/,\s*sentence\s+\d+\s*$/i, '').trim() || 'Unknown source';
}

export function practiceFingerprint(item) {
  return `${item.evidenceId || ''}|${String(item.question || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

export function tokenJaccard(left, right) {
  const a = new Set(contentTokens(left));
  const b = new Set(contentTokens(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((token) => { if (b.has(token)) shared += 1; });
  return shared / (a.size + b.size - shared);
}

export function keyPhrase(record) {
  const weak = new Set(['shows', 'showed', 'showing', 'used', 'using', 'also', 'still', 'often', 'make', 'makes']);
  const tokens = (record.tokens || contentTokens(record.sentence)).filter((token) => token.length > 3 && !weak.has(token));
  const sentence = record.sentence || '';
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sentence)) {
      return titleCase(phrase);
    }
  }
  const token = tokens[0];
  if (token && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sentence)) {
    return titleCase(token);
  }
  return null;
}

export function rankDistractors(answer, phrases, evidence, random = Math.random) {
  const unique = [...new Set(phrases.filter((phrase) => phrase && phrase.toLowerCase() !== String(answer).toLowerCase()))];
  if (!unique.length) return [];
  const docs = unique.map((phrase) => ({ phrase, tokens: contentTokens(phrase) }));
  const ranked = buildBm25Index(docs).rank(contentTokens(evidence)).map((hit) => hit.record.phrase);
  const rest = unique.filter((phrase) => !ranked.includes(phrase));
  return [...ranked, ...shuffle(rest, random)].slice(0, 3);
}

export function questionFromRecord(record, phrases, { random = Math.random, sourceLabels = [] } = {}) {
  if (studyValue(record) < 0) return null;
  const answer = keyPhrase(record);
  if (!answer) return null;
  const distractors = rankDistractors(answer, phrases, record.sentence, random);
  const choices = shuffle([...new Set([answer, ...distractors])], random);
  if (choices.length < 2) return null;
  const label = record.source;
  const pattern = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const canCloze = pattern.test(record.sentence);
  const builders = [];
  if (canCloze) {
    builders.push(() => ({
      type: 'cloze',
      question: `Fill in the blank from a source passage: “${truncate(record.sentence.replace(pattern, '______'), 180)}”`,
      choices,
      answer,
      evidenceId: record.id,
      evidenceExcerpt: record.sentence,
      source: `${record.source}, sentence ${record.index}`,
      explanation: `The missing phrase in the source sentence is ${answer}.`,
    }));
  }
  builders.push(() => ({
    type: 'concept-match',
    question: `Which idea does this passage describe? “${truncate(record.sentence, 140)}”`,
    choices,
    answer,
    evidenceId: record.id,
    evidenceExcerpt: record.sentence,
    source: `${record.source}, sentence ${record.index}`,
    explanation: `The passage describes ${answer}.`,
  }));
  if (sourceLabels.length > 1) {
    const sourceChoices = shuffle([...new Set([label, ...sourceLabels.filter((name) => name !== label)])].slice(0, 4), random);
    if (sourceChoices.length > 1) {
      builders.push(() => ({
        type: 'source',
        question: `Which input source contains this statement: “${truncate(record.sentence, 140)}”?`,
        choices: sourceChoices,
        answer: label,
        evidenceId: record.id,
        evidenceExcerpt: record.sentence,
        source: `${record.source}, sentence ${record.index}`,
        explanation: `This sentence was taken from ${label}.`,
      }));
    }
  }
  return builders[Math.floor(random() * builders.length)]();
}

export function weakSources(sourceResults = []) {
  return sourceResults
    .filter((row) => row.attempted > 0 && row.correct < row.attempted)
    .sort((left, right) => (left.correct / left.attempted) - (right.correct / right.attempted))
    .map((row) => row.source);
}

function phrasePool(pack, records) {
  const phrases = (pack.concepts || []).map((concept) => concept.term);
  records.forEach((record) => {
    const phrase = keyPhrase(record);
    if (phrase) phrases.push(phrase);
  });
  return phrases;
}

function mentionsTerms(text, terms) {
  const value = String(text || '').toLowerCase();
  return terms.size > 0 && [...terms].some((term) => term && value.includes(term));
}

export function buildPracticeSet(pack, {
  exclude = [],
  preferSources = [],
  preferTerms = [],
  limit = 5,
  random = Math.random,
} = {}) {
  const records = pack.corpus?.sentenceRecords || [];
  const coverage = buildCoverage(pack.corpus, [...(pack.summary || []), ...(pack.concepts || []), ...(pack.quiz || []), ...exclude]);
  const unusedIds = new Set(coverage.unused.map((item) => item.id));
  const excluded = new Set(exclude.map(practiceFingerprint));
  const excludedEvidence = new Set(exclude.map((item) => item.evidenceId).filter(Boolean));
  const usable = records.filter((record) => studyValue(record) >= 0);
  const unused = usable.filter((record) => unusedIds.has(record.id));
  const pool = unused.length ? unused : usable;
  const sourceLabels = [...new Set(records.map((record) => record.source))];
  const phrases = phrasePool(pack, records);
  const prefer = new Set(preferSources.filter(Boolean));
  const terms = new Set(preferTerms.map((term) => String(term || '').toLowerCase()).filter(Boolean));
  const candidates = pool.flatMap((record) => {
    const question = questionFromRecord(record, phrases, { random, sourceLabels });
    if (!question) return [];
    const unique = !excluded.has(practiceFingerprint(question)) && !excludedEvidence.has(record.id);
    const termHit = mentionsTerms(`${question.question} ${question.answer} ${record.sentence}`, terms);
    return [{
      ...question,
      unique,
      relevance: (unique ? 1 : 0.12)
        + (unusedIds.has(record.id) ? 0.45 : 0)
        + (prefer.has(record.source) ? 0.35 : 0)
        + (termHit ? 0.4 : 0),
    }];
  });
  const focused = prefer.size || terms.size
    ? candidates.filter((item) => {
      const record = records.find((entry) => entry.id === item.evidenceId);
      return (prefer.size && prefer.has(record?.source)) || mentionsTerms(`${item.question} ${item.answer} ${record?.sentence}`, terms);
    })
    : [];
  const uniquePool = (focused.length ? focused : candidates).filter((item) => item.unique);
  const working = uniquePool.length ? uniquePool : (focused.length ? focused : candidates);
  const selected = selectMmr(working, {
    limit,
    lambda: 0.7,
    similarity: (left, right) => tokenJaccard(`${left.question} ${left.evidenceExcerpt}`, `${right.question} ${right.evidenceExcerpt}`),
  });
  const quiz = randomizeQuizChoiceOrder(selected.map(({ relevance, unique, ...item }) => item), random);
  const unusedUsed = quiz.filter((item) => unusedIds.has(item.evidenceId)).length;
  const unique = selected.filter((item) => item.unique).length;
  const reused = selected.length - unique;
  const exhausted = !quiz.length || unique === 0;
  const questionWord = quiz.length === 1 ? 'question' : 'questions';
  let message;
  if (!quiz.length) {
    message = 'There is not enough remaining source material to build another question set. Try the current questions again, or add more notes.';
  } else if (unique === 0) {
    message = 'No unused passages are left, so this set reuses earlier evidence with a different mix. Add more material if you want genuinely new questions.';
  } else if (reused) {
    message = `Built ${quiz.length} ${questionWord} from remaining passages. ${unusedUsed} unused sentence(s) used. ${reused} item(s) reused earlier evidence.`;
  } else if (unusedUsed) {
    message = `Built ${quiz.length} new ${questionWord} from unused passages (${unusedUsed} of ${unused.length} unused sentences). None match earlier question wording.`;
  } else {
    message = `Built ${quiz.length} new ${questionWord} that do not repeat earlier wording. No uncited sentences remained, so these use other leftover evidence.`;
  }
  if (prefer.size && !focused.length && quiz.length) {
    message += ' Weaker-source targeting had too little leftover evidence, so the mix used other remaining passages.';
  }
  return {
    quiz,
    report: {
      requested: limit,
      built: quiz.length,
      unusedAvailable: unused.length,
      unusedUsed,
      unique,
      reused,
      exhausted,
      focused: Boolean(focused.length),
      preferSources: [...prefer],
      preferTerms: [...terms],
      distractorMethod: 'bm25-evidence',
      selection: 'mmr-unused-first',
      graphFollowUp: Boolean(terms.size),
      message,
    },
  };
}

export function relatedFollowUp(pack, missedItems = [], options = {}) {
  if (!missedItems.length) {
    return {
      quiz: [],
      report: {
        requested: options.limit || 5,
        built: 0,
        unusedAvailable: 0,
        unusedUsed: 0,
        unique: 0,
        reused: 0,
        exhausted: true,
        focused: false,
        message: 'Miss at least one question first, and the related-ideas follow-up can use that evidence to find a nearby concept.',
      },
    };
  }
  const concepts = pack.concepts?.[0]?.related ? pack.concepts : attachRelatedConcepts(pack.concepts || []);
  const missedEvidence = new Set(missedItems.map((item) => item.evidenceId));
  const related = new Set();
  concepts.forEach((concept) => {
    const hit = missedEvidence.has(concept.evidenceId)
      || missedItems.some((item) => String(item.answer || '').toLowerCase() === String(concept.term).toLowerCase());
    if (!hit) return;
    related.add(concept.term);
    (concept.related || []).forEach((term) => related.add(term));
  });
  return buildPracticeSet(pack, {
    ...options,
    preferTerms: [...related],
    preferSources: missedItems.map(sourceName),
  });
}

export function buildFollowUpCards(pack, { exclude = [], limit = 8 } = {}) {
  const usedEvidence = new Set(exclude.map((card) => card.evidenceId));
  const usedTerms = new Set(exclude.map((card) => String(card.term || '').toLowerCase()));
  const coverage = buildCoverage(pack.corpus, [...(pack.summary || []), ...(pack.concepts || []), ...(pack.quiz || [])]);
  const unusedIds = new Set(coverage.unused.map((item) => item.id));
  const records = pack.corpus?.sentenceRecords || [];
  const unused = records.filter((record) => unusedIds.has(record.id) && !usedEvidence.has(record.id) && studyValue(record) >= 0);
  const cards = [];
  for (const record of unused) {
    const term = keyPhrase(record);
    if (!term || usedTerms.has(term.toLowerCase())) continue;
    usedTerms.add(term.toLowerCase());
    cards.push({
      term,
      prompt: `What does this unused source passage say about ${term}?`,
      answer: record.sentence,
      evidenceId: record.id,
      source: record.source,
    });
    if (cards.length >= limit) break;
  }
  if (cards.length < limit) {
    for (const concept of pack.concepts || []) {
      const key = String(concept.term).toLowerCase();
      if (usedTerms.has(key) || usedEvidence.has(concept.evidenceId)) continue;
      const record = records.find((item) => item.id === concept.evidenceId);
      if (!record) continue;
      usedTerms.add(key);
      cards.push({
        term: concept.term,
        prompt: `What does your material say about ${concept.term}?`,
        answer: record.sentence,
        evidenceId: record.id,
        source: record.source,
      });
      if (cards.length >= limit) break;
    }
  }
  const unusedUsed = cards.filter((card) => unusedIds.has(card.evidenceId)).length;
  const message = !cards.length
    ? 'There is not enough remaining source material to build new flashcards.'
    : unused.length
      ? `Prepared ${cards.length} cards, including ${unusedUsed} from previously uncited sentences.`
      : 'No unused passages remain for new cards. These cards reuse concept evidence from the current pack.';
  return {
    cards,
    report: {
      built: cards.length,
      unusedAvailable: unused.length,
      unusedUsed,
      exhausted: !unused.length || !cards.length,
      message,
    },
  };
}
