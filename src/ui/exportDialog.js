import { downloadBlob } from '../export/download.js';

/** Native modal keeps keyboard focus inside; textContent/value never render source HTML. */
export function showExport(content, format) {
  document.getElementById('exportDialog')?.remove();
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'exportDialog';
  dialog.className = 'export-dialog';
  dialog.setAttribute('aria-labelledby', 'exportTitle');
  dialog.innerHTML = `<h2 id="exportTitle">Export revision pack</h2>
    <p>Download your pack, or copy the text if your browser blocks downloads. This includes quiz answers and source excerpts: check before sharing.</p>
    <label for="exportContent">Export preview</label>
    <textarea id="exportContent" readonly spellcheck="false"></textarea>
    <div class="export-actions"><button type="button" data-export="download">Download file</button>
    <button type="button" data-export="copy">Copy text</button>
    <button type="button" data-export="close">Close export</button></div>
    <p role="status" aria-live="polite"></p>`;
  const field = dialog.querySelector('textarea');
  field.value = content;
  field.setSelectionRange(0, 0);
  const status = dialog.querySelector('[role="status"]');
  const extension = format === 'json' ? 'json' : 'md';
  dialog.querySelector('[data-export="download"]').addEventListener('click', () => {
    try {
      downloadBlob(new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' }), `ai-study-companion-revision-pack.${extension}`);
      status.textContent = 'Download requested. If nothing appears in Downloads, try Copy text.';
    } catch {
      status.textContent = 'This browser could not start the download. Try Copy text instead.';
    }
  });
  dialog.querySelector('[data-export="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content);
      status.textContent = 'Copied. Paste it into a text editor and save it as a .' + extension + ' file.';
    } catch {
      field.focus(); field.select();
      status.textContent = 'Automatic copying is unavailable. The text is selected—press Ctrl+C (or Command+C) to copy it.';
    }
  });
  dialog.querySelector('[data-export="close"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
