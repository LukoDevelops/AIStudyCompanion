export const DISPLAY_MODES = Object.freeze({
  LIGHT: 'light',
  NIGHT: 'night',
});

export const DISPLAY_MODE_STORAGE_KEY = 'aiStudyCompanion.displayMode.v1';

function safeStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

export function readDisplayMode(storage = globalThis.localStorage) {
  try {
    return safeStorage(storage)?.getItem(DISPLAY_MODE_STORAGE_KEY) === DISPLAY_MODES.NIGHT
      ? DISPLAY_MODES.NIGHT
      : DISPLAY_MODES.LIGHT;
  } catch {
    return DISPLAY_MODES.LIGHT;
  }
}

function setText(node, text) {
  if (node) node.textContent = text;
}

export function applyDisplayMode(mode, { documentRef = globalThis.document } = {}) {
  const nextMode = mode === DISPLAY_MODES.NIGHT ? DISPLAY_MODES.NIGHT : DISPLAY_MODES.LIGHT;
  const button = documentRef?.getElementById?.('displayModeBtn');
  const label = button?.querySelector?.('.mode-toggle-label');
  const isNight = nextMode === DISPLAY_MODES.NIGHT;
  const action = isNight ? 'Switch to Daylight mode' : 'Switch to Night Study mode';

  if (documentRef?.documentElement?.dataset) documentRef.documentElement.dataset.displayMode = nextMode;
  if (documentRef?.body?.dataset) documentRef.body.dataset.displayMode = nextMode;
  if (documentRef?.documentElement?.style) documentRef.documentElement.style.colorScheme = isNight ? 'dark' : 'light';
  button?.setAttribute?.('aria-pressed', String(isNight));
  button?.setAttribute?.('aria-label', action);
  button?.setAttribute?.('title', action);
  setText(label, isNight ? 'Daylight mode' : 'Night mode');
  return nextMode;
}

export function bindDisplayMode({ documentRef = globalThis.document, storage = globalThis.localStorage } = {}) {
  const button = documentRef?.getElementById?.('displayModeBtn');
  let current = applyDisplayMode(readDisplayMode(storage), { documentRef });

  if (!button || typeof button.addEventListener !== 'function') return current;

  button.addEventListener('click', () => {
    current = applyDisplayMode(
      current === DISPLAY_MODES.NIGHT ? DISPLAY_MODES.LIGHT : DISPLAY_MODES.NIGHT,
      { documentRef },
    );
    try {
      safeStorage(storage)?.setItem(DISPLAY_MODE_STORAGE_KEY, current);
    } catch {
      // Private browsing and locked-down embeds can reject localStorage writes.
    }
  });

  return current;
}
