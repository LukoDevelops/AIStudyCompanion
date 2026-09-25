// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { bindLightbox, openLightbox } from '../src/ui/lightbox.js';
it('contains keyboard focus, isolates the background and restores it on Escape', () => {
  document.body.innerHTML = '<main><button id="trigger">Preview</button></main><div id="imageLightbox" class="hidden" hidden><img id="lightboxImage"><span id="lightboxCaption"></span><button id="lightboxClose">Close</button></div>';
  document.querySelector('main').inert = false;
  document.getElementById('trigger').focus(); bindLightbox(); openLightbox('blob:test', 'Test image');
  expect(document.querySelector('main').inert).toBe(true);
  expect(document.activeElement.id).toBe('lightboxClose');
  const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }); document.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('main').inert).toBe(false);
  expect(document.activeElement.id).toBe('trigger');
  expect(document.getElementById('lightboxImage').hasAttribute('src')).toBe(false);
});
