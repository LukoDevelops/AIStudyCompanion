// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { showExport } from '../src/ui/exportDialog.js';
import { downloadBlob } from '../src/export/download.js';
vi.mock('../src/export/download.js', () => ({ downloadBlob: vi.fn() }));
beforeEach(() => {
  document.body.innerHTML = '<button id="launch">Export</button>';
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('renders source markup as plain text and restores focus on close', () => {
  document.getElementById('launch').focus();
  showExport('<img src=x onerror=alert(1)>', 'md');
  expect(document.querySelector('dialog').open).toBe(true);
  expect(document.querySelector('textarea').value).toContain('<img');
  expect(document.querySelector('dialog img')).toBeNull();
  document.querySelector('[data-export="close"]').click();
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.activeElement.id).toBe('launch');
});
it('requests a file without claiming a successful save', () => {
  showExport('{}', 'json'); document.querySelector('[data-export="download"]').click();
  expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'ai-study-companion-revision-pack.json');
  expect(document.querySelector('[role="status"]').textContent).toContain('Download requested');
});
it('copies the complete export', async () => {
  const writeText = vi.fn().mockResolvedValue(); vi.stubGlobal('navigator', { clipboard: { writeText } });
  showExport('full content', 'md'); document.querySelector('[data-export="copy"]').click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith('full content');
  expect(document.querySelector('[role="status"]').textContent).toContain('Copied.');
});
it('selects the export for manual copying when clipboard access fails', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  showExport('fallback content', 'json'); document.querySelector('[data-export="copy"]').click();
  await Promise.resolve();
  const field = document.querySelector('textarea');
  expect(field.selectionEnd - field.selectionStart).toBe(field.value.length);
  expect(document.querySelector('[role="status"]').textContent).toContain('Automatic copying is unavailable');
});
it('keeps copy available if creating a download throws', () => {
  downloadBlob.mockImplementationOnce(() => { throw new Error('blocked'); });
  showExport('text', 'md'); document.querySelector('[data-export="download"]').click();
  expect(document.querySelector('[role="status"]').textContent).toContain('could not start');
});
