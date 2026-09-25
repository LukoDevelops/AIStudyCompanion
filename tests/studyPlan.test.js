import { describe, expect, it } from 'vitest';
import { buildStudyPlan, modalitySummary, studyReadiness } from '../src/pipeline/studyPlan.js';

function pack(overrides = {}) {
  return {
    summary: [{ text: 'A summary point' }],
    concepts: [{ term: 'Concept' }],
    quiz: [{ question: 'Question' }, { question: 'Another question' }],
    corpus: { sources: [
      { origin: 'text', label: 'notes' },
      { origin: 'whisper', label: 'recording' },
      { origin: 'vision', label: 'diagram' },
    ] },
    analytics: { coverage: { coveragePct: 75 } },
    checks: { groundingCoverage: 90, integrity: { linkCoverage: 100, sourceRepresentationPct: 80, issues: [] } },
    ...overrides,
  };
}

describe('study plan', () => {
  it('summarises the input modalities without treating them as accuracy scores', () => {
    expect(modalitySummary(pack())).toMatchObject({ text: 1, audio: 1, image: 1, total: 3 });
  });

  it('produces a transparent readiness score from pack checks and practice state', () => {
    const result = studyReadiness(pack(), { practice: { total: 2, attempted: 1 }, cardsReviewed: 1 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.metrics).toHaveLength(4);
    expect(result.explanation).not.toMatch(/grade|guarantee/i);
  });

  it('turns structural issues and missed questions into concrete next actions', () => {
    const result = buildStudyPlan(pack({ checks: { groundingCoverage: 80, integrity: { linkCoverage: 80, sourceRepresentationPct: 60, issues: [{ message: 'review' }] } } }), {
      practice: { total: 2, attempted: 2, firstCorrect: 1, missed: 1 },
      cardsReviewed: 0,
    });
    expect(result).toHaveLength(5);
    expect(result.find((item) => item.id === 'verify').state).toBe('attention');
    expect(result.find((item) => item.id === 'reinforce').title).toContain('missed');
  });
});
