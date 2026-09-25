import { describe, expect, it } from 'vitest';
import { buildStudyAudit } from '../src/pipeline/studyAudit.js';

const pack = {
  sourceCount: 2,
  quiz: [{}, {}],
  concepts: [{}, {}],
  corpus: {
    sources: [{ origin: 'paste' }, { origin: 'vision' }],
    sentenceRecords: Array.from({ length: 10 }, () => ({})),
  },
  analytics: { coverage: { usedCount: 8, coveragePct: 80 } },
  checks: {
    coveragePct: 80,
    groundingCoverage: 90,
    adapterWarnings: [],
    integrity: { linkCoverage: 90, sourceRepresentationPct: 80, issues: [] },
  },
};

describe('study evidence audit', () => {
  it('combines traceability and practice signals into explainable checks', () => {
    const audit = buildStudyAudit(pack, { practice: { total: 2, attempted: 2 }, cardsReviewed: 1 });
    expect(audit.score).toBeGreaterThanOrEqual(80);
    expect(audit.label).toBe('Traceable');
    expect(audit.checks.map((check) => check.id)).toEqual(['coverage', 'links', 'input-lanes', 'recall', 'integrity']);
    expect(audit.checks.find((check) => check.id === 'input-lanes').value).toBe('2/3');
  });

  it('makes import warnings and structural issues visible without crashing', () => {
    const audit = buildStudyAudit({
      ...pack,
      analytics: { coverage: { usedCount: 1, coveragePct: 10 } },
      checks: { ...pack.checks, adapterWarnings: ['broken.png failed'], integrity: { linkCoverage: 20, sourceRepresentationPct: 0, issues: ['missing evidence'] } },
      corpus: { sources: [{ origin: 'image' }], sentenceRecords: Array.from({ length: 10 }, () => ({})) },
    });
    expect(audit.tone).toBe('attention');
    expect(audit.checks.find((check) => check.id === 'integrity').value).toBe('1 issue');
    expect(audit.checks.find((check) => check.id === 'integrity').detail).toContain('human check');
  });
});
