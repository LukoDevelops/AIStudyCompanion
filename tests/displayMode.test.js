import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.useFakeTimers();
    documentRef = documentFixture();
    storage = storageFixture();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
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

  it('uses a crossfade only when the mode is changed, not on initial load', async () => {
    let complete;
    const finished = new Promise(resolve => { complete = resolve; });
    documentRef.startViewTransition = vi.fn(update => {
      update();
      return { ready: Promise.resolve(), finished, skipTransition: vi.fn() };
    });
    bindDisplayMode({ documentRef, storage });
    expect(documentRef.startViewTransition).not.toHaveBeenCalled();
    documentRef.button.click();
    expect(documentRef.startViewTransition).toHaveBeenCalledOnce();
    expect(documentRef.documentElement.dataset.modeTransition).toBe('crossfade');
    expect(documentRef.body.dataset.displayMode).toBe('night');
    expect(storage.setItem).toHaveBeenLastCalledWith(DISPLAY_MODE_STORAGE_KEY, 'night');
    complete();
    await finished;
    expect(documentRef.documentElement.dataset.modeTransition).toBeUndefined();
  });

  it('keeps the latest choice when clicked again before the snapshot callback', async () => {
    let update, complete;
    const effect = { ready: Promise.resolve(), finished: new Promise(resolve => { complete = resolve; }), skipTransition: vi.fn() };
    documentRef.startViewTransition = vi.fn(callback => { update = callback; return effect; });
    bindDisplayMode({ documentRef, storage });
    documentRef.button.click();
    documentRef.button.click();
    expect(effect.skipTransition).toHaveBeenCalledOnce();
    expect(documentRef.body.dataset.displayMode).toBe('light');
    update();
    expect(documentRef.body.dataset.displayMode).toBe('light');
    expect(documentRef.button.attributes['aria-pressed']).toBe('false');
    expect(storage.setItem).toHaveBeenLastCalledWith(DISPLAY_MODE_STORAGE_KEY, 'light');
    complete();
    await effect.finished;
    documentRef.button.click();
    expect(documentRef.startViewTransition).toHaveBeenCalledTimes(2);
  });

  it('respects reduced motion without starting a transition', () => {
    documentRef.defaultView = { matchMedia: vi.fn(() => ({ matches: true })) };
    documentRef.startViewTransition = vi.fn();
    bindDisplayMode({ documentRef, storage });
    documentRef.button.click();
    expect(documentRef.startViewTransition).not.toHaveBeenCalled();
    expect(documentRef.documentElement.dataset.modeTransition).toBeUndefined();
    expect(documentRef.body.dataset.displayMode).toBe('night');
  });

  it('eases colours in older browsers and removes the temporary style', () => {
    bindDisplayMode({ documentRef, storage });
    documentRef.button.click();
    expect(documentRef.documentElement.dataset.modeTransition).toBe('colors');
    vi.advanceTimersByTime(300);
    documentRef.button.click();
    vi.advanceTimersByTime(300);
    expect(documentRef.documentElement.dataset.modeTransition).toBe('colors');
    vi.advanceTimersByTime(200);
    expect(documentRef.documentElement.dataset.modeTransition).toBeUndefined();
    expect(documentRef.body.dataset.displayMode).toBe('light');
  });

  it('still switches if the snapshot API throws', () => {
    documentRef.startViewTransition = vi.fn(() => { throw new Error('unavailable'); });
    bindDisplayMode({ documentRef, storage });
    expect(() => documentRef.button.click()).not.toThrow();
    expect(documentRef.body.dataset.displayMode).toBe('night');
    expect(documentRef.documentElement.dataset.modeTransition).toBe('colors');
  });

  it('handles a skipped snapshot without an unhandled rejection', async () => {
    const finished = Promise.resolve();
    documentRef.startViewTransition = vi.fn(update => {
      update();
      return { ready: Promise.reject(new Error('hidden tab')), finished, skipTransition: vi.fn() };
    });
    bindDisplayMode({ documentRef, storage });
    documentRef.button.click();
    await finished;
    expect(documentRef.body.dataset.displayMode).toBe('night');
    expect(documentRef.documentElement.dataset.modeTransition).toBeUndefined();
  });
});
