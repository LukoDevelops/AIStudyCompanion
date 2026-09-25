import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDisplayMode, bindDisplayMode, DISPLAY_MODE_STORAGE_KEY, DISPLAY_MODES, readDisplayMode } from '../src/ui/displayMode.js';

function documentFixture() {
  const listeners = {};
  const label = { textContent: '' };
  const button = {
    attributes: {},
    querySelector: vi.fn(() => label),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { listeners[name] = callback; },
    click() { listeners.click?.(); },
  };
  return {
    documentElement: { dataset: {}, style: {} },
    body: { dataset: {} },
    getElementById: vi.fn(() => button),
    button,
    label,
  };
}

function storageFixture(initial = null) {
  const values = new Map(initial ? [[DISPLAY_MODE_STORAGE_KEY, initial]] : []);
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
}

describe('display mode', () => {
  let documentRef;
  let storage;

  beforeEach(() => {
    documentRef = documentFixture();
    storage = storageFixture();
  });

  it('defaults to light mode and exposes the night-mode action', () => {
    expect(readDisplayMode(storage)).toBe(DISPLAY_MODES.LIGHT);
    expect(applyDisplayMode(DISPLAY_MODES.LIGHT, { documentRef })).toBe(DISPLAY_MODES.LIGHT);
    expect(documentRef.body.dataset.displayMode).toBe('light');
    expect(documentRef.documentElement.dataset.displayMode).toBe('light');
    expect(documentRef.documentElement.style.colorScheme).toBe('light');
    expect(documentRef.button.attributes['aria-pressed']).toBe('false');
    expect(documentRef.button.attributes['aria-label']).toBe('Switch to Night Study mode');
    expect(documentRef.label.textContent).toBe('Night mode');
  });

  it('restores night mode and toggles the persisted value', () => {
    storage = storageFixture(DISPLAY_MODES.NIGHT);
    expect(bindDisplayMode({ documentRef, storage })).toBe(DISPLAY_MODES.NIGHT);
    expect(documentRef.body.dataset.displayMode).toBe('night');
    expect(documentRef.documentElement.dataset.displayMode).toBe('night');
    expect(documentRef.documentElement.style.colorScheme).toBe('dark');
    expect(documentRef.button.attributes['aria-pressed']).toBe('true');
    expect(documentRef.label.textContent).toBe('Daylight mode');

    documentRef.button.click();
    expect(documentRef.body.dataset.displayMode).toBe('light');
    expect(storage.setItem).toHaveBeenLastCalledWith(DISPLAY_MODE_STORAGE_KEY, DISPLAY_MODES.LIGHT);
    expect(documentRef.button.attributes['title']).toBe('Switch to Night Study mode');
  });

  it('treats invalid and unavailable storage as light mode without crashing', () => {
    expect(readDisplayMode(storageFixture('solarized'))).toBe(DISPLAY_MODES.LIGHT);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(bindDisplayMode({ documentRef, storage: broken })).toBe(DISPLAY_MODES.LIGHT);
    expect(() => documentRef.button.click()).not.toThrow();
    expect(documentRef.body.dataset.displayMode).toBe('night');
    expect(documentRef.documentElement.style.colorScheme).toBe('dark');
  });
});
