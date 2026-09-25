import { expect, it } from 'vitest';
import { shuffle } from '../src/pipeline/text.js';
import { buildQuiz, randomizeQuizChoiceOrder } from '../src/pipeline/quiz.js';
import { runPipeline } from '../src/pipeline/orchestrator.js';

const pinned = () => 0.37;
const item = { question: 'Which idea?', choices: ['correct', 'alpha', 'bravo', 'charlie'], answer: 'correct' };

it('shows why a constant 0.37 RNG always put the first option in the second slot', () => {
  expect(shuffle(['correct', 'alpha', 'bravo', 'charlie'], pinned).indexOf('correct')).toBe(1);
  expect(shuffle(['correct', 'wrong'], pinned).indexOf('correct')).toBe(1);
});

it('keeps the answer text while moving it across choice slots', () => {
  const positions = new Set();
  for (let i = 0; i < 80; i += 1) {
    const [question] = randomizeQuizChoiceOrder([item]);
    expect(question.choices).toEqual(expect.arrayContaining(['correct', 'alpha', 'bravo', 'charlie']));
    expect(question.answer).toBe('correct');
    positions.add(question.choices.indexOf('correct'));
  }
  expect(positions.size).toBeGreaterThan(2);
});

it('uses Math.random for live generation instead of a constant RNG', async () => {
  const sources = [{
    label: 'Notes',
    text: 'Photosynthesis is the process plants use to convert light into chemical energy. Respiration is the process cells use to release energy from glucose. Chlorophyll is the pigment that absorbs red and blue light.',
    origin: 'paste',
    adapter: 'text',
  }];
  const original = Math.random;
  let calls = 0;
  Math.random = () => { calls += 1; return original(); };
  try {
    const pack = await runPipeline(sources, { engine: 'local', pause: 0 });
    expect(pack.quiz.every(question => question.choices.includes(question.answer))).toBe(true);
    expect(calls).toBeGreaterThan(0);
  } finally {
    Math.random = original;
  }
});

it('still builds a usable quiz when a caller supplies a seeded RNG', () => {
  const corpus = {
    sources: [{ label: 'Notes' }],
    sentenceRecords: [
      { id: 'a', source: 'Notes', index: 1, sentence: 'Osmosis is the movement of water across a membrane.', tokens: ['osmosis', 'movement', 'water'] },
      { id: 'b', source: 'Notes', index: 2, sentence: 'Diffusion is the net movement of particles from high to low concentration.', tokens: ['diffusion', 'particles'] },
    ],
  };
  const concepts = [
    { term: 'Osmosis', evidence: corpus.sentenceRecords[0].sentence, evidenceId: 'a', source: 'Notes, sentence 1' },
    { term: 'Diffusion', evidence: corpus.sentenceRecords[1].sentence, evidenceId: 'b', source: 'Notes, sentence 2' },
  ];
  const quiz = buildQuiz(concepts, corpus, { random: pinned, limit: 4 });
  expect(quiz.length).toBeGreaterThan(0);
  expect(quiz.every(question => question.choices.includes(question.answer))).toBe(true);
});
