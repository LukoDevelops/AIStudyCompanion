import { describe, expect, it } from 'vitest';
import {
  buildFollowUpCards,
  buildPracticeSet,
  practiceFingerprint,
  rankDistractors,
  relatedFollowUp,
  tokenJaccard,
  weakSources,
} from '../src/pipeline/practiceBank.js';

function rng(seed = 3) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const sentences = {
  s1: 'Photosynthesis converts light energy into chemical energy inside plant leaves.',
  s2: 'Chlorophyll absorbs sunlight and starts the photosynthetic reaction in chloroplasts.',
  s3: 'Cellular respiration releases stored chemical energy from glucose molecules during metabolism.',
  s4: 'Mitochondria carry out the later stages of respiration in eukaryotic cells with oxygen.',
  s5: 'Hybrid retrieval combines lexical matching with semantic ranking for grounded study search.',
};

function record(id, source, index) {
  return { id, source, index, sentence: sentences[id] };
}

const pack = {
  summary: [{ text: sentences.s1, evidenceId: 's1' }],
  concepts: [
    { term: 'Photosynthesis energy', evidenceId: 's1', source: 'Notes' },
    { term: 'Chemical energy', evidenceId: 's2', source: 'Notes' },
    { term: 'Cellular respiration', evidenceId: 's3', source: 'Audio' },
  ],
  quiz: [{
    question: 'Which idea does this passage describe? “Photosynthesis converts light energy into chemical energy inside plant leaves.”',
    choices: ['Photosynthesis Energy', 'Guessing'],
    answer: 'Photosynthesis Energy',
    evidenceId: 's1',
    evidenceExcerpt: sentences.s1,
    source: 'Notes, sentence 1',
  }],
  corpus: {
    sentenceRecords: [
      record('s1', 'Notes', 1),
      record('s2', 'Notes', 2),
      record('s3', 'Audio', 1),
      record('s4', 'Audio', 2),
      record('s5', 'Notes', 3),
    ],
  },
};

describe('practice bank', () => {
  it('ranks BM25 distractors from the evidence rather than inserting random labels first', () => {
    const ranked = rankDistractors(
      'Photosynthesis Energy',
      ['Chlorophyll Absorbs', 'Random Widget', 'Photosynthetic Reaction', 'Mitochondria Carry'],
      sentences.s2,
      () => 0.5,
    );
    expect(ranked[0]).not.toBe('Random Widget');
    expect(ranked.slice(0, 2).join(' ')).toMatch(/Chlorophyll|Photosynthetic/i);
  });

  it('builds a new set from unused passages that does not repeat earlier fingerprints', () => {
    const built = buildPracticeSet(pack, { exclude: pack.quiz, limit: 3, random: rng(11) });
    expect(built.quiz.length).toBeGreaterThan(0);
    expect(built.quiz.every((item) => item.evidenceId !== 's1')).toBe(true);
    const seen = new Set(pack.quiz.map(practiceFingerprint));
    built.quiz.forEach((item) => {
      expect(seen.has(practiceFingerprint(item))).toBe(false);
      seen.add(practiceFingerprint(item));
      expect(item.choices).toContain(item.answer);
      expect(item.choices.length).toBeGreaterThan(1);
    });
    expect(built.report.unique).toBe(built.quiz.length);
    expect(built.report.exhausted).toBe(false);
    expect(built.report.message).toMatch(/unused|new questions/i);
  });

  it('reports exhaustion when leftover study-worthy material cannot support a unique set', () => {
    const thin = {
      ...pack,
      corpus: { sentenceRecords: [record('s1', 'Notes', 1)] },
      concepts: [{ term: 'Photosynthesis energy', evidenceId: 's1', source: 'Notes' }, { term: 'Mitochondria', evidenceId: 's1', source: 'Notes' }],
    };
    const built = buildPracticeSet(thin, { exclude: pack.quiz, limit: 4, random: rng(4) });
    expect(built.report.exhausted).toBe(true);
    expect(built.report.message).toMatch(/unused|enough|reuses|remaining/i);
  });

  it('prefers weaker sources and graph neighbours when asked', () => {
    const weak = buildPracticeSet(pack, { exclude: pack.quiz, preferSources: ['Audio'], limit: 2, random: rng(21) });
    expect(weak.quiz.some((item) => item.evidenceId === 's3' || item.evidenceId === 's4')).toBe(true);
    const related = relatedFollowUp(pack, pack.quiz, { exclude: pack.quiz, limit: 2, random: rng(8) });
    expect(related.report.graphFollowUp).toBe(true);
    expect(related.quiz.length).toBeGreaterThan(0);
    expect(weakSources([{ source: 'Audio', attempted: 2, correct: 0 }, { source: 'Notes', attempted: 2, correct: 2 }])).toEqual(['Audio']);
  });

  it('builds flashcards from unused sentences before reusing concept evidence', () => {
    const cards = buildFollowUpCards(pack, { exclude: [{ term: 'Photosynthesis energy', evidenceId: 's1' }], limit: 4 });
    expect(cards.cards.length).toBeGreaterThan(0);
    expect(cards.cards.some((card) => card.evidenceId !== 's1')).toBe(true);
    expect(cards.report.message).toMatch(/uncited|unused|cards/i);
  });

  it('treats near-duplicate wording as highly similar for MMR', () => {
    expect(tokenJaccard(sentences.s1, sentences.s1)).toBe(1);
    expect(tokenJaccard(sentences.s1, 'Photosynthesis converts light energy into stored chemical energy.')).toBeGreaterThan(tokenJaccard(sentences.s1, sentences.s5));
  });
});
