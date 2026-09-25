// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { bindFileInputs, resetFileInputs, selectedFiles } from '../src/ui/fileInputs.js';
import { runJob } from '../src/runtime/client.js';
vi.mock('../src/runtime/client.js', () => ({ runJob: vi.fn() }));
it('aborts reset previews and ignores their late text and progress', async () => {
  document.body.innerHTML = '<form id="studyForm"><textarea id="textNotes"></textarea><input id="textFile" type="file"></form>';
  let resolvePreview, options;
  runJob.mockImplementation((payload, opts) => { options = opts; return new Promise(resolve => { resolvePreview = resolve; }); });
  const status = vi.fn(); bindFileInputs({ onStatus: status });
  const input = document.getElementById('textFile');
  Object.defineProperty(input, 'files', { value: [new File(['old'], 'old.txt', { type: 'text/plain' })] });
  input.dispatchEvent(new Event('change'));
  expect(runJob).toHaveBeenCalledOnce(); resetFileInputs(); status.mockClear();
  expect(options.signal.aborted).toBe(true);
  options.onStatus('stale progress'); resolvePreview('stale text'); await Promise.resolve();
  expect(document.getElementById('textNotes').value).toBe('');
  expect(selectedFiles().textFiles).toEqual([]); expect(status).not.toHaveBeenCalled();
});
