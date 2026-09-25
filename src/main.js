import { readStoredKey, storeKey } from "./adapters/generationAdapter.js";
import { toExportablePack } from "./export/json.js";
import { toMarkdown } from "./export/markdown.js";
import { showExport } from './ui/exportDialog.js';
import { sample } from "./sample.js";
import { bindFileInputs, cancelFilePreview, notesForPipeline, resetFileInputs, selectedFiles } from "./ui/fileInputs.js";
import { bindCursorGlow } from "./ui/glow.js";
import { loadHistory, renderHistory, saveHistoryItem } from "./ui/history.js";
import { hydrateIcons } from "./ui/icons.js";
import { bindEvidenceControls, bindInsightControls, hideComparePanel, renderCompare, renderResults, resetResults, setActiveStage, setStatus, showError } from "./ui/render.js";
import { runJob } from "./runtime/client.js";
import { validateInputs } from "./runtime/limits.js";
import { prepareAudio } from "./runtime/audio.js";
import { engineName, recordTiming, renderEngineMetrics } from "./ui/engines.js";
import { openWorkspaceView } from './ui/studyWorkspace.js';
import { clearStudyProgress } from './ui/studyProgress.js';
import { bindDisplayMode } from './ui/displayMode.js';
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';

const $ = id => document.getElementById(id);
const form = $('studyForm');
document.querySelector('.skip-link')?.addEventListener('click',()=>openWorkspaceView('inputs'));
let latestResult = null, active = null, timer = null;
const selectedEngine = () => document.querySelector('input[name="engine"]:checked')?.value || 'local';
const selectedVisionMode = () => document.querySelector('input[name="visionMode"]:checked')?.value || 'local';
function syncCloudControls() {
  const enabled = selectedEngine() === 'cloud';
  document.querySelectorAll('input[name="visionMode"]').forEach(input => {
    const available = input.value === (enabled ? 'cloud' : 'local');
    input.checked = available;
    input.disabled = !available || !!active;
    input.closest('label')?.classList.toggle('is-disabled', !available);
  });
  document.querySelector('.optional-cloud')?.classList.toggle('is-disabled', !enabled);
  $('cloudKey').disabled = !enabled || !!active;
  $('freeTierOnly').disabled = !enabled || !!active;
  $('polishBtn').disabled = !enabled || !!active || !latestResult;
}
function busy(on) {
  if ($('heroSampleBtn')) $('heroSampleBtn').disabled = on;
  $('runProgress').classList.toggle('hidden', !on);
  form.setAttribute('aria-busy', String(on));
  form.querySelectorAll('input,textarea,button,select,sl-button').forEach(node => { node.disabled = on; });
  $('cancelBtn').disabled = !on;
  document.body.classList.toggle('is-processing', on);
  document.dispatchEvent(new Event('study-processing-change'));
  syncCloudControls();
}
function refreshHistory() {
  renderHistory(loadHistory(), { onLoad: pack => {
    if (active) return;
    try { renderResults(pack); }
    catch { showError('This saved pack could not be displayed. Regenerate it from your original material.'); return; }
    latestResult = pack; $('exportBtn').disabled = false; $('exportMdBtn').disabled = false; syncCloudControls();
    setStatus('Loaded a saved pack. Build it again if you want the latest engine changes.');
  }, onClear: refreshHistory });
}
function inputs() {
  return {
    notes: notesForPipeline($('textNotes').value), transcript: $('audioTranscript').value,
    description: $('imageDescription').value, ...selectedFiles(),
    useLocalCaption: selectedVisionMode() === 'local', cloudVision: selectedVisionMode() === 'cloud',
    cloudKey: $('cloudKey').value.trim()
  };
}
async function execute(action) {
  if (active) return;
  showError('');
  const data = inputs(), engine = selectedEngine();
  try {
    validateInputs(data);
    if (((data.cloudVision && data.imageFiles.length) || engine === 'cloud' || action === 'polish') && !data.cloudKey) {
      document.querySelector('.optional-cloud').open = true;
      $('cloudKey').focus();
      throw new Error('Add a Google AI Studio key or choose a local engine. The free-tier link opens the setup page.');
    }
    if ((engine === 'cloud' || data.cloudVision || action === 'polish') && !$('freeTierOnly').checked) throw new Error('Confirm that this key belongs to a free-tier Google project with billing turned off before using cloud features.');
  } catch (error) { showError(error.message); return; }
  active = new AbortController();
  cancelFilePreview();
  const signal = active.signal, started = performance.now();
  busy(true); hideComparePanel();
  $('runElapsed').textContent = '0s elapsed';
  $('runStage').textContent = 'Getting your material ready…';
  const status = message => { if (!signal.aborted) { setStatus(message); $('runStage').textContent = message; } };
  timer = setInterval(() => { $('runElapsed').textContent = Math.round((performance.now()-started)/1000) + 's elapsed'; }, 500);
  try {
    if (action !== 'polish') data.audioFiles = await prepareAudio(data.audioFiles, signal, status);
    signal.throwIfAborted();
    const result = await runJob(action === 'polish' ? {action,pack:latestResult,key:data.cloudKey} : {action,inputs:data,engine}, {
      signal, onStatus:status, onStage:stage => { if (!signal.aborted) setActiveStage(stage); }
    });
    signal.throwIfAborted();
    latestResult = action === 'compare' ? result.packs.local : result;
    renderResults(latestResult, {keepCompare:action === 'compare'});
    if (action === 'compare') { renderCompare(result); openWorkspaceView('explore'); }
    const persistence = saveHistoryItem(latestResult); refreshHistory();
    $('exportBtn').disabled = false; $('exportMdBtn').disabled = false;
    if (action === 'generate') recordTiming(latestResult.engine, performance.now()-started);
    setStatus('Your ' + engineName(latestResult.engine) + ' pack is ready. Open a source link to see the passage behind a result.' + (persistence.saved ? '' : ' This browser could not save the pack, so export it before closing or reloading.'));
  } catch (error) {
    showError(signal.aborted ? 'This run was stopped. Your inputs and previous results are still here.' : error.message);
    setStatus('This run has stopped. Adjust your inputs and try again.');
  } finally {
    clearInterval(timer); active = null; busy(false);
  }
}
form.addEventListener('submit', event => { event.preventDefault(); execute('generate'); });
$('compareBtn').addEventListener('click', () => execute('compare'));
$('polishBtn').addEventListener('click', () => { if (latestResult) execute('polish'); });
$('cancelBtn').addEventListener('click', () => active?.abort());
$('sampleBtn').addEventListener('click', () => {
  $('textNotes').value = sample.text; $('audioTranscript').value = sample.audio; $('imageDescription').value = sample.image;
  ['textNotes', 'audioTranscript', 'imageDescription'].forEach(id => $(id).dispatchEvent(new Event('input', {bubbles:true})));
  showError(''); setStatus('Example material is ready.');
});
$('heroSampleBtn')?.addEventListener('click', () => {
  if (active) return;
  $('sampleBtn').click();
  $('textNotes').focus();
  $('studyForm').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});
$('resetBtn').addEventListener('click', () => {
  if (latestResult) clearStudyProgress(latestResult);
  form.reset(); resetFileInputs(); latestResult = null; resetResults();
  $('cloudKey').value = readStoredKey(); syncCloudControls();
  $('exportBtn').disabled = true; $('exportMdBtn').disabled = true;
});
$('exportBtn').addEventListener('click', () => latestResult && showExport(JSON.stringify(toExportablePack(latestResult), null, 2), 'json'));
$('exportMdBtn').addEventListener('click', () => latestResult && showExport(toMarkdown(latestResult), 'md'));
document.querySelectorAll('input[name="visionMode"], input[name="engine"]').forEach(input => input.addEventListener('change', () => {
  syncCloudControls();
  showError('');
  setStatus(`${engineName(selectedEngine())} selected. Image processing has been matched to it.`);
  if (selectedVisionMode() === 'cloud' || selectedEngine() === 'cloud') document.querySelector('.optional-cloud').open = true;
}));
$('cloudKey').value = readStoredKey();
$('cloudKey').addEventListener('change', () => storeKey($('cloudKey').value.trim()));
syncCloudControls(); hydrateIcons(); renderEngineMetrics();
bindDisplayMode();
form.addEventListener('input', () => { if (!active) showError(''); });
bindFileInputs({onStatus:message => { if (!active) { showError(''); setStatus(message); } }}); bindEvidenceControls(); bindInsightControls(); bindCursorGlow(); refreshHistory();
