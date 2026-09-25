import { runBenchmark } from '../src/evaluation/benchmark.js';
const result = await runBenchmark();
console.log(JSON.stringify(result, null, 2));
if (result.rows.some(row => row.error || !row.integrity.passed)) process.exitCode = 1;
