import { expect, it } from 'vitest';
import { benchmarkCases, runBenchmark, seededRandom } from '../src/evaluation/benchmark.js';
import { runPipeline } from '../src/pipeline/orchestrator.js';

it('reproduces the same random sequence for a seed', () => {
  const a = seededRandom(5), b = seededRandom(5);
  expect(Array.from({length:20}, a)).toEqual(Array.from({length:20}, b));
});
it('runs both offline engines on identical fixtures with valid output structure', async () => {
  const result = await runBenchmark({repetitions:1});
  expect(result.rows).toHaveLength(benchmarkCases.length * 2);
  for (const row of result.rows) {
    expect(row.error).toBeUndefined();
    expect(row.integrity.issues, `${row.caseId}/${row.engine}`).toEqual([]);
    expect(row.integrity.linkCoverage).toBe(100);
    expect(row.summarySourceCount).toBe(benchmarkCases.find(c => c.id === row.caseId).sources.length);
  }
});
it('rejects invalid repetitions and accidental cloud benchmark usage', async () => {
  await expect(runBenchmark({repetitions:0})).rejects.toThrow();
  await expect(runBenchmark({engines:['cloud']})).rejects.toThrow();
});
it('rejects unknown engine identifiers', async () => {
  await expect(runPipeline(benchmarkCases[0].sources, {engine:'typo'})).rejects.toThrow('Unknown');
});
