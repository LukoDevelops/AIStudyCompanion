// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStudyProgress, loadStudyProgress, progressKey, saveStudyProgress, STUDY_PROGRESS_STORAGE_KEY } from '../src/ui/studyProgress.js';

const pack = { generatedAt: '2026-09-21T00:00:00.000Z', engine: 'local', corpus: { sentenceRecords: [{ id: 'a' }, { id: 'b' }] } };

describe('study progress storage', () => {
  beforeEach(() => localStorage.clear());

  it('uses a stable pack key and round-trips only the current pack state', () => {
    expect(progressKey(pack)).toBe(progressKey({ ...pack, corpus: { sentenceRecords: [{ id: 'a' }, { id: 'b' }] } }));
    expect(saveStudyProgress(pack, { view: 'practice', mode: 'quiz', flashIndex: 2, practice: { cursor: 1 }, ratings: [[0, 'again']] })).toBe(true);
    expect(loadStudyProgress(pack)).toMatchObject({ view: 'practice', mode: 'quiz', flashIndex: 2, practice: { cursor: 1 }, ratings: [[0, 'again']] });
    expect(localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY)).toContain(progressKey(pack));
  });

  it('clears one pack without touching another saved pack', () => {
    const other = { ...pack, generatedAt: '2026-09-22T00:00:00.000Z' };
    saveStudyProgress(pack, { view: 'read' });
    saveStudyProgress(other, { view: 'sources' });
    clearStudyProgress(pack);
    expect(loadStudyProgress(pack)).toBeNull();
    expect(loadStudyProgress(other)).toMatchObject({ view: 'sources' });
  });
});
