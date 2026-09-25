export const ENGINES = {
  baseline: {name:'Keyword Scout', capability:'Finds repeated terms and matching sentences', cost:'Lightweight · no download'},
  local: {name:'Hybrid Focus', capability:'Balances ranked passages and section coverage', cost:'Light · no download'},
  semantic: {name:'Semantic Explorer', capability:'Finds related passages by meaning', cost:'Medium · model download'},
  cloud: {name:'Study Reasoner', capability:'Drafts summaries and questions with AI', cost:'Cloud · free-tier key required'},
};
export function engineName(id) { return ENGINES[id]?.name || id; }
const key = 'aiStudyCompanion.engineTimings';
function timings() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.fromEntries(Object.keys(ENGINES).map(id => [id, Array.isArray(saved?.[id]) ? saved[id].filter(n => Number.isFinite(n) && n >= 0).slice(-10) : []]));
  } catch { return {}; }
}
export function recordTiming(engine, ms) {
  if (!Number.isFinite(ms)) return;
  const values = timings(); values[engine] = [...(values[engine] || []), ms].slice(-10);
  try { localStorage.setItem(key, JSON.stringify(values)); } catch {}
  renderEngineMetrics();
}
export function renderEngineMetrics() {
  const values = timings();
  document.querySelectorAll('[data-engine-metric]').forEach(node => {
    const id = node.dataset.engineMetric, config = ENGINES[id], runs = values[id] || [];
    node.textContent = `${config.capability} · ${config.cost}. ${runs.length ? `Your average: ${(runs.reduce((a,b)=>a+b,0)/runs.length/1000).toFixed(1)}s across ${runs.length} run${runs.length === 1 ? "" : "s"}.` : 'Timing will appear after your first run.'}`;
  });
}
