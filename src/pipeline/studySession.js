import { buildBm25Index } from './bm25.js';
import { sourceName } from './practiceBank.js';
import { contentTokens, shuffle } from './text.js';

export function createEvidenceSearch(records, items = []) {
  const indexed = records.map(record => ({...record, tokens:record.tokens || contentTokens(record.sentence)}));
  const index = buildBm25Index(indexed);
  const cited = new Set(items.map(item => item.evidenceId));
  return (query = '', {source = '', citation = 'all'} = {}) => {
    const terms = contentTokens(query);
    const literal = query.trim().toLowerCase();
    return indexed.map((record, position) => ({record, position, cited:cited.has(record.id), score:terms.length ? index.score(position, terms) : 0}))
      .filter(hit => (!source || hit.record.source === source) &&
        (citation === 'all' || hit.cited === (citation === 'cited')) &&
        (!literal || hit.score > 0 || hit.record.sentence.toLowerCase().includes(literal)))
      .sort((a,b) => b.score - a.score || a.position - b.position);
  };
}

export const CONFIDENCE_LEVELS = [
  { id: 'unsure', label: 'Unsure', value: 0.33 },
  { id: 'fairly', label: 'Fairly sure', value: 0.66 },
  { id: 'sure', label: 'Sure', value: 1 },
];

export function updateLeitnerBox(box, rating) {
  if (rating === 'again') return 1;
  return Math.min(3, (box || 1) + 1);
}

export function weakerCardIndexes(length, boxes) {
  return [...Array(length).keys()].filter((index) => (boxes.get(index) || 1) === 1);
}

export function brierScore(attempts) {
  const rated = attempts.filter((attempt) => attempt.confidence != null);
  if (!rated.length) return null;
  return rated.reduce((total, attempt) => {
    const outcome = attempt.correct ? 1 : 0;
    return total + (attempt.confidence - outcome) ** 2;
  }, 0) / rated.length;
}

// Practice statistics are serialisable for local resume, not a measure of educational effectiveness.
export function practiceItemKey(item) {
  return `${item?.evidenceId || ''}|${String(item?.question || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

export function createPracticeSession(quiz, { state = null } = {}) {
  let items = quiz;
  const attempts = new Map();
  let queue = quiz.map((_, index) => index);
  let cursor = 0;
  let revealed = false;
  let pendingConfidence = null;

  function currentId() {
    return queue[cursor];
  }

  function restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.deck)) return false;
    const currentKeys = items.map(practiceItemKey);
    if (snapshot.deck.length !== currentKeys.length || snapshot.deck.some((key, index) => key !== currentKeys[index])) return false;
    const ids = new Map(currentKeys.map((key, index) => [key, index]));
    const nextQueue = Array.isArray(snapshot.queue)
      ? snapshot.queue.map((key) => ids.get(key)).filter((id) => id !== undefined)
      : currentKeys.map((_, index) => index);
    if (!nextQueue.length && currentKeys.length) return false;
    attempts.clear();
    (Array.isArray(snapshot.attempts) ? snapshot.attempts : []).forEach(([key, attempt]) => {
      const id = ids.get(key);
      if (id === undefined || !attempt || typeof attempt !== 'object') return;
      attempts.set(id, {
        count: Math.max(1, Number(attempt.count) || 1),
        firstCorrect: Boolean(attempt.firstCorrect),
        correct: Boolean(attempt.correct),
        choice: typeof attempt.choice === 'string' ? attempt.choice : '',
        confidence: Number.isFinite(attempt.confidence) ? attempt.confidence : null,
      });
    });
    queue = nextQueue;
    cursor = Math.max(0, Math.min(queue.length, Number(snapshot.cursor) || 0));
    revealed = Boolean(snapshot.revealed) && cursor < queue.length;
    pendingConfidence = Number.isFinite(snapshot.pendingConfidence) ? snapshot.pendingConfidence : null;
    return true;
  }

  const session = {
    get current() { return currentId() ?? null; },
    get position() { return cursor; },
    get length() { return queue.length; },
    get revealed() { return revealed; },
    get lastCorrect() { return attempts.get(currentId())?.correct ?? null; },
    get pendingConfidence() { return pendingConfidence; },
    items() { return items; },
    setConfidence(level) {
      const match = CONFIDENCE_LEVELS.find((entry) => entry.id === level);
      pendingConfidence = match ? match.value : null;
      return pendingConfidence;
    },
    answer(choice) {
      const id = currentId();
      if (id === undefined || revealed || !items[id].choices.includes(choice)) return null;
      const previous = attempts.get(id);
      const correct = choice === items[id].answer;
      attempts.set(id, {
        count: (previous?.count || 0) + 1,
        firstCorrect: previous?.firstCorrect ?? correct,
        correct,
        choice,
        confidence: previous?.confidence ?? pendingConfidence,
      });
      pendingConfidence = null;
      revealed = true;
      return correct;
    },
    next() { if (!revealed) return false; cursor += 1; revealed = false; pendingConfidence = null; return true; },
    retryMissed() {
      queue = [...attempts].filter(([, attempt]) => !attempt.correct).map(([id]) => id);
      cursor = 0;
      revealed = false;
      pendingConfidence = null;
      return queue.length;
    },
    replaceDeck(next, { shuffleOrder = false, random = Math.random } = {}) {
      items = next;
      attempts.clear();
      pendingConfidence = null;
      queue = next.map((_, index) => index);
      if (shuffleOrder) queue = shuffle(queue, random);
      cursor = 0;
      revealed = false;
      return queue.length;
    },
    stats() {
      const values = [...attempts.values()];
      return {
        total: items.length,
        attempted: values.length,
        firstCorrect: values.filter((attempt) => attempt.firstCorrect).length,
        currentCorrect: values.filter((attempt) => attempt.correct).length,
        missed: values.filter((attempt) => !attempt.correct).length,
        attempts: values.reduce((count, attempt) => count + attempt.count, 0),
      };
    },
    calibration() {
      const values = [...attempts.values()];
      const rated = values.filter((attempt) => attempt.confidence != null);
      const brier = brierScore(values);
      const overconfident = rated.filter((attempt) => attempt.confidence >= 0.66 && !attempt.correct).length;
      const meanConfidence = rated.length
        ? rated.reduce((total, attempt) => total + attempt.confidence, 0) / rated.length
        : 0;
      return {
        rated: rated.length,
        brier: brier == null ? null : Number(brier.toFixed(3)),
        overconfident,
        meanConfidence: Number(meanConfidence.toFixed(2)),
      };
    },
    sourceResults() {
      const groups = new Map();
      items.forEach((item, id) => {
        const source = sourceName(item);
        const group = groups.get(source) || { source, total: 0, attempted: 0, correct: 0 };
        group.total += 1;
        if (attempts.has(id)) {
          group.attempted += 1;
          if (attempts.get(id).correct) group.correct += 1;
        }
        groups.set(source, group);
      });
      return [...groups.values()];
    },
    missedItems() {
      return [...attempts].filter(([, attempt]) => !attempt.correct).map(([id]) => items[id]);
    },
    snapshot() {
      return {
        deck: items.map(practiceItemKey),
        queue: queue.map((id) => practiceItemKey(items[id])),
        cursor,
        revealed,
        pendingConfidence,
        attempts: [...attempts].map(([id, attempt]) => [practiceItemKey(items[id]), { ...attempt }]),
      };
    },
    restore,
  };

  if (state) restore(state);
  return session;
}

export function buildFlashcards(pack) {
  const records = new Map(pack.corpus.sentenceRecords.map(record => [record.id, record]));
  const seen = new Set();
  return pack.concepts.flatMap((concept) => {
    const record = records.get(concept.evidenceId);
    const key = String(concept.term).toLowerCase();
    if (!record || seen.has(key)) return [];
    seen.add(key);
    return [{
      term: concept.term,
      prompt: `What does your material say about ${concept.term}?`,
      answer: record.sentence,
      evidenceId: record.id,
      source: record.source,
    }];
  });
}
