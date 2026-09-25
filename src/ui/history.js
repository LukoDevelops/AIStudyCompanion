import { engineName } from "./engines.js";
import { escapeHtml } from "../pipeline/text.js";
const STORAGE_KEY = "aiStudyCompanion.history.v1";
const LIMIT = 8;

function usablePack(pack) {
  if (!pack || !Array.isArray(pack.summary) || !Array.isArray(pack.quiz) || !Array.isArray(pack.concepts) || !Array.isArray(pack.nextSteps)) return false;
  if (!pack.checks || !Array.isArray(pack.checks.prototypeLimitations) || !Array.isArray(pack.corpus?.sentenceRecords)) return false;
  if (pack.checks.integrity && !Array.isArray(pack.checks.integrity.issues)) return false;
  if (pack.analytics && [pack.analytics.graphEdges, pack.analytics.quizTypes, pack.analytics.coverage?.bySource].some(value => value != null && !Array.isArray(value))) return false;
  return pack.summary.every(item => item && typeof item.text === 'string') &&
    pack.concepts.every(item => item && typeof item.term === 'string') &&
    pack.quiz.every(item => item && typeof item.question === 'string' && Array.isArray(item.choices) && item.choices.every(choice => typeof choice === 'string')) &&
    pack.corpus.sentenceRecords.every(record => record && typeof record.id === 'string' && typeof record.sentence === 'string');
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    return Array.isArray(saved) ? saved.filter(item => item && usablePack(item.pack)).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(result) {
  const item = {
    id: result.generatedAt,
    generatedAt: result.generatedAt,
    engine: result.engine,
    sourceCount: result.sourceCount,
    conceptCount: result.concepts.length,
    pack: result,
  };

  const history = [item, ...loadHistory().filter((entry) => entry.id !== item.id)].slice(
    0,
    LIMIT
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return { history, saved: true };
  } catch {
    // Preserve existing storage and the in-memory result. Never silently prune
    // older packs to squeeze a large new pack into an unknown browser quota.
    return { history: loadHistory(), saved: false };
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }

  return [];
}

export function renderHistory(history, { onLoad, onClear }) {
  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  const clearBtn = document.getElementById("clearHistoryBtn");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!history.length) {
    empty?.classList.remove("hidden");
    if (clearBtn) {
      clearBtn.disabled = true;
    }
    return;
  }

  empty?.classList.add("hidden");
  if (clearBtn) {
    clearBtn.disabled = false;
  }

  history.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    const when = new Date(item.generatedAt).toLocaleString();
    const retrieval = item.pack?.retrieval ? ` · ${item.pack.retrieval}` : "";
    button.innerHTML = `<strong>${escapeHtml(when)}</strong><span>${escapeHtml(String(item.sourceCount))} sources · ${escapeHtml(String(item.conceptCount))} concepts · ${escapeHtml(engineName(item.engine))}${escapeHtml(retrieval)}</span>`;
    button.addEventListener("click", () => onLoad(item.pack));
    list.appendChild(button);
  });

  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = "true";
    clearBtn.addEventListener("click", () => {
      if (!window.confirm('Clear all saved revision packs in this browser? Export any packs you want to keep first.')) return;
      onClear(clearHistory());
    });
  }
}
