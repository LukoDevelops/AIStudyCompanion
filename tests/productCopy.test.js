import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

it('keeps visible product copy in North American English', () => {
  const copy = [read('index.html'), read('src/ui/studyWorkspace.js'), read('README.md')].join('\n');
  expect(copy).not.toMatch(/\bpractise\b/i);
  expect(copy).not.toMatch(/\brecentre\b/i);
});
