import { classifyAudioFile } from "../adapters/audioAdapter.js";
import { runJob } from '../runtime/client.js';
import { validateInputs, LIMITS } from '../runtime/limits.js';
import { isImageFile } from "../adapters/imageAdapter.js";
import {
  classifyTextFile,
  extractTextForInsert,
  formatCompiledNotes,
  notesBeyondCompiled,
} from "../adapters/textAdapter.js";
import { escapeHtml } from "../pipeline/text.js";
import { bindDropzone, blockWindowDrops, hideAllDropzones } from "./dropzone.js";
import { hydrateIcons, icon } from "./icons.js";
import { bindLightbox, openLightbox } from "./lightbox.js";

const GROUPS = [
  {
    key: "text",
    input: "textFile",
    list: "textFileList",
    group: "textGroup",
    icon: "file",
    dropMessage: "Drop notes, PDF, or Word files",
    accepts: (file) => classifyTextFile(file) !== "unsupported",
    rejection: "needs a .txt, .md, .pdf, or .docx file",
  },
  {
    key: "audio",
    input: "audioFile",
    list: "audioFileList",
    group: "audioGroup",
    icon: "mic",
    dropMessage: "Drop audio or transcript files",
    accepts: (file) => classifyAudioFile(file) !== "unsupported",
    rejection: "needs an audio file or a text transcript",
  },
  {
    key: "image",
    input: "imageFile",
    list: "imageFileList",
    group: "imageGroup",
    icon: "image",
    dropMessage: "Drop images",
    accepts: (file) => isImageFile(file),
    rejection: "needs an image file",
  },
];

const selected = { text: [], audio: [], image: [] };
const previews = new Map();
let statusHandler = () => {};
let compiledSnapshot = "";
let compileToken = 0;
let previewController = null;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function previewFor(file) {
  const key = fileKey(file);

  if (!previews.has(key)) {
    previews.set(key, URL.createObjectURL(file));
  }

  return previews.get(key);
}

function releasePreviews(files) {
  const keep = new Set(files.map(fileKey));

  previews.forEach((url, key) => {
    if (!keep.has(key)) {
      URL.revokeObjectURL(url);
      previews.delete(key);
    }
  });
}

function describeFile(group, file) {
  if (group.key === "audio") {
    return classifyAudioFile(file) === "transcript" ? "Transcript text" : "Local Whisper";
  }

  if (group.key === "text") {
    const kind = classifyTextFile(file);
    return kind === "pdf" ? "PDF text" : kind === "docx" ? "Word text" : "Plain text";
  }

  return "Local OCR and image reading";
}

function renderList(group) {
  renderIntakeSummary();
  const list = document.getElementById(group.list);

  if (!list) {
    return;
  }

  const files = selected[group.key];
  list.innerHTML = "";
  list.classList.toggle("hidden", files.length === 0);
  list.classList.toggle("is-gallery", group.key === "image");

  files.forEach((file, index) => {
    const item = document.createElement("li");
    item.className = "file-chip";

    const thumb =
      group.key === "image"
        ? `<button type="button" class="file-thumb-btn" data-preview="${previewFor(file)}" data-caption="${escapeHtml(file.name)}" aria-label="Preview ${escapeHtml(file.name)}">
            <img class="file-thumb" src="${previewFor(file)}" alt="" />
          </button>`
        : `<span class="file-chip-icon">${icon(group.icon, { size: 18 })}</span>`;

    item.innerHTML = `
      ${thumb}
      <span class="file-chip-body">
        <span class="file-chip-name">${escapeHtml(file.name)}</span>
        <span class="file-chip-meta">${escapeHtml(describeFile(group, file))} · ${formatSize(file.size)}</span>
      </span>
      <button type="button" class="chip-remove" data-group="${group.key}" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
    `;

    list.appendChild(item);
  });

  const card = document.getElementById(group.input)?.closest(".file-card");
  const name = document.getElementById(`${group.input}Name`);

  if (name) {
    name.textContent = files.length
      ? `${files.length} file${files.length === 1 ? "" : "s"} attached`
      : "No file selected yet";
  }

  card?.classList.toggle("has-file", files.length > 0);
}

function renderIntakeSummary() {
  const files = Object.values(selected).flat();
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  const pastedLanes = ['textNotes', 'audioTranscript', 'imageDescription']
    .filter((id) => document.getElementById(id)?.value.trim());
  const pasted = pastedLanes.length > 0;
  const hasMaterial = files.length > 0 || pasted;
  const count = document.getElementById('intakeCount');
  const detail = document.getElementById('intakeDetail');
  const meter = document.getElementById('intakeMeter');
  const summary = document.querySelector('.intake-summary');
  summary?.classList.toggle('has-material', hasMaterial);
  if (count) count.textContent = files.length
    ? `${files.length} file${files.length === 1 ? '' : 's'} · ${formatSize(bytes)}`
    : pasted ? 'Pasted material is ready' : 'Nothing added yet';
  if (detail) detail.textContent = hasMaterial
    ? `${selected.text.length} note file${selected.text.length === 1 ? '' : 's'} · ${selected.audio.length} audio or transcript file${selected.audio.length === 1 ? '' : 's'} · ${selected.image.length} image${selected.image.length === 1 ? '' : 's'}${pasted ? ` · ${pastedLanes.length} pasted field${pastedLanes.length === 1 ? '' : 's'}` : ''}.`
    : 'Add a file or paste something below. You can mix notes, audio, and images.';
  if (meter) {
    const progress = Math.min(100, files.length / 16 * 100);
    if (meter.tagName === 'SL-PROGRESS-BAR') meter.value = progress;
    else meter.style.width = `${progress}%`;
  }
}

function applyCompiled(textarea, compiled) {
  const current = textarea.value;

  if (!compiled) {
    textarea.value = notesBeyondCompiled(current, compiledSnapshot);
    compiledSnapshot = "";
    return;
  }

  if (!current.trim() || current.trim() === compiledSnapshot.trim()) {
    textarea.value = compiled;
  } else if (compiledSnapshot && current.includes(compiledSnapshot)) {
    textarea.value = current.replace(compiledSnapshot, compiled);
  } else if (!current.includes(compiled)) {
    textarea.value = `${current.trim()}\n\n${compiled}`;
  }

  compiledSnapshot = compiled;
}

async function syncCompiledNotes() {
  const token = ++compileToken;
  previewController?.abort();
  previewController = new AbortController();
  const signal = previewController.signal;
  const textarea = document.getElementById("textNotes");

  if (!textarea) {
    return;
  }

  const files = selected.text;

  if (!files.length) {
    applyCompiled(textarea, "");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  statusHandler("Reading your note files into the box in order…");
  const parts = [];
  let totalCharacters = 0;

  for (const file of files) {
    try {
      const text = await runJob({action:'preview', file}, {onStatus: message => {
        if (!signal.aborted && token === compileToken) statusHandler(message);
      }, signal});
      if (signal.aborted || token !== compileToken) return;

      if (text) {
        totalCharacters += text.length;
        if (totalCharacters > LIMITS.characters) {
          statusHandler('The combined preview is over 600,000 characters. Try smaller batches of notes.');
          return;
        }
        parts.push({ name: file.name, text });
      }
    } catch {
      if (signal.aborted) return;
      statusHandler(`${file.name} is still attached, but its text could not be previewed here.`);
    }
  }

  if (token !== compileToken) {
    return;
  }

  applyCompiled(textarea, formatCompiledNotes(parts));
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  statusHandler(
    `Read ${parts.length} note file${parts.length === 1 ? "" : "s"} in order. Each file is also kept as its own source.`
  );
}

function addFiles(group, incoming) {
  if (document.getElementById('studyForm')?.getAttribute('aria-busy') === 'true') return;
  const rejected = [];
  const existing = new Set(selected[group.key].map(fileKey));
  let added = 0;

  incoming.forEach((file) => {
    try { validateInputs({[`${group.key}Files`]: [file]}); }
    catch (error) { rejected.push(error.message); return; }
    if (!group.accepts(file)) {
      rejected.push(file.name);
      return;
    }

    if (existing.has(fileKey(file))) {
      return;
    }
    try {
      validateInputs({textFiles:selected.text, audioFiles:selected.audio, imageFiles:selected.image, [`${group.key}Files`]:[...selected[group.key],file]});
    } catch (error) { rejected.push(error.message); return; }

    existing.add(fileKey(file));
    selected[group.key].push(file);
    added += 1;
  });

  hideAllDropzones();
  renderList(group);

  if (group.key === "text") {
    syncCompiledNotes();
  }

  if (rejected.length) {
    statusHandler(`Skipped ${rejected.join(", ")}: this field ${group.rejection}.`);
  } else if (added) {
    statusHandler(
      `Added ${added} file${added === 1 ? "" : "s"} to ${group.key}. They’ll be processed when you build the pack.`
    );
  }
}

export function cancelFilePreview() {
  previewController?.abort();
  compileToken++;
}

export function bindFileInputs({ onStatus = () => {} } = {}) {
  statusHandler = onStatus;
  blockWindowDrops();
  bindLightbox();

  GROUPS.forEach((group) => {
    const input = document.getElementById(group.input);
    const groupElement = document.getElementById(group.group);

    if (input) {
      input.multiple = true;
      input.addEventListener("change", () => {
        addFiles(group, Array.from(input.files || []));
        input.value = "";
      });
    }

    if (groupElement) {
      bindDropzone(groupElement, {
        message: group.dropMessage,
        onFiles: (files) => addFiles(group, files),
      });
    }

    renderList(group);
  });

  document.querySelectorAll('#textNotes, #audioTranscript, #imageDescription')
    .forEach((textarea) => textarea.addEventListener('input', renderIntakeSummary));

  document.addEventListener("click", (event) => {
    const preview = event.target.closest(".file-thumb-btn");

    if (preview) {
      event.preventDefault();
      openLightbox(preview.dataset.preview, preview.dataset.caption);
      return;
    }

    const button = event.target.closest(".chip-remove");

    if (!button) {
      return;
    }

    const group = GROUPS.find((candidate) => candidate.key === button.dataset.group);

    if (!group) {
      return;
    }

    selected[group.key].splice(Number(button.dataset.index), 1);
    releasePreviews(Object.values(selected).flat());
    renderList(group);

    if (group.key === "text") {
      syncCompiledNotes();
    }
  });

  document.querySelectorAll("[data-clear-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = GROUPS.find(
        (candidate) => candidate.input === button.dataset.clearFile
      );

      if (!group) {
        return;
      }

      selected[group.key] = [];
      releasePreviews(Object.values(selected).flat());
      renderList(group);
      hideAllDropzones();

      if (group.key === "text") {
        syncCompiledNotes();
      }
    });
  });

  hydrateIcons();
}

export function selectedFiles() {
  return {
    textFiles: [...selected.text],
    audioFiles: [...selected.audio],
    imageFiles: [...selected.image],
  };
}

export function notesForPipeline(notes) {
  return notesBeyondCompiled(notes, compiledSnapshot);
}

export function resetFileInputs() {
  cancelFilePreview();
  GROUPS.forEach((group) => {
    selected[group.key] = [];
    renderList(group);
  });

  compiledSnapshot = "";
  compileToken += 1;
  releasePreviews([]);
  hideAllDropzones();
}
