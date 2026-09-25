const STORAGE_KEY = 'aiStudyCompanion.studyProgress.v1';
const LIMIT = 8;

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function progressKey(pack) {
  const records = pack?.corpus?.sentenceRecords || [];
  const seed = [pack?.generatedAt || '', pack?.engine || '', ...records.map((record) => record.id)].join('|');
  return hash(seed);
}

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanEntries(value) {
  return Array.isArray(value)
    ? value.filter((entry) => Array.isArray(entry) && entry.length === 2 && (typeof entry[0] === 'string' || typeof entry[0] === 'number'))
    : [];
}

export function loadStudyProgress(pack) {
  if (!pack?.generatedAt) return null;
  const saved = readStore()[progressKey(pack)];
  if (!saved || saved.version !== 1) return null;
  return { ...saved, ratings: cleanEntries(saved.ratings), boxes: cleanEntries(saved.boxes) };
}

export function saveStudyProgress(pack, state = {}) {
  if (!pack?.generatedAt) return false;
  const store = readStore();
  store[progressKey(pack)] = {
    version: 1,
    updatedAt: new Date().toISOString(),
    view: typeof state.view === 'string' ? state.view : 'overview',
    mode: state.mode === 'cards' ? 'cards' : 'quiz',
    flashIndex: Number.isFinite(state.flashIndex) ? Math.max(0, state.flashIndex) : 0,
    practice: state.practice || null,
    ratings: cleanEntries(state.ratings),
    boxes: cleanEntries(state.boxes),
  };
  const ordered = Object.entries(store)
    .sort(([, left], [, right]) => String(right?.updatedAt || '').localeCompare(String(left?.updatedAt || '')))
    .slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(ordered)));
    return true;
  } catch {
    return false;
  }
}

export function clearStudyProgress(pack) {
  if (!pack?.generatedAt) return {};
  const store = readStore();
  delete store[progressKey(pack)];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* best effort */ }
  return store;
}

export const STUDY_PROGRESS_STORAGE_KEY = STORAGE_KEY;
