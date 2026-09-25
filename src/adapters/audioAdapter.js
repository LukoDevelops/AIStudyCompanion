import { normaliseDocument } from "../pipeline/document.js";
import { normalise } from "../pipeline/text.js";

const TRANSCRIPT_EXTENSIONS = [".txt", ".md", ".vtt", ".srt", ".csv", ".log"];
const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".aac",
  ".ogg",
  ".oga",
  ".opus",
  ".flac",
  ".webm",
];

let transcriberPromise = null;

export function classifyAudioFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  if (TRANSCRIPT_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "transcript";
  }

  if (
    type.startsWith("audio/") ||
    type === "video/mp4" ||
    type === "video/webm" ||
    AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension))
  ) {
    return "audio";
  }

  return type.startsWith("text/") ? "transcript" : "unsupported";
}

/** Subtitle files carry timings and cue numbers that are not study content. */
export function stripSubtitleMarkup(text) {
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  // Plain transcripts can contain meaningful numeric lines. Only interpret cue
  // identifiers and metadata when this is actually a subtitle document.
  if (!/^WEBVTT\b/m.test(source) && !/\d[\d:.,]*\s*-->\s*\d/.test(source)) return source.trim();
  return source.split(/\n\s*\n/).flatMap(block => {
    const lines = block.trim().split('\n');
    if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) return [];
    const timing = lines.findIndex(line => /^\s*[\d:.,]+\s*-->\s*[\d:.,]+/.test(line));
    return timing < 0 ? [] : lines.slice(timing + 1);
  }).join('\n').replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|nbsp|quot);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&nbsp;':' ','&quot;':'"'}[entity]))
    .trim();
}

async function loadTranscriber(onStatus) {
  if (!transcriberPromise) {
    transcriberPromise = import("@huggingface/transformers").then(async ({ pipeline }) => {
      onStatus(
        "Downloading the local Whisper speech-to-text model. This happens once, then the file stays on this computer."
      );
      return pipeline("automatic-speech-recognition", "Xenova/whisper-base.en", {device: "wasm", dtype: "q8"});
    });
  }

  return transcriberPromise;
}

export async function transcribeAudioFile(file, onStatus = () => {}) {
  if (file.preparationError) throw new Error(file.preparationError);
  if (!file.pcm) throw new Error('This audio has not passed the size and duration checks yet. Use up to 30 minutes of recordings or paste a transcript.');
  if (!file.pcm.some(sample => Number.isFinite(sample) && Math.abs(sample) > 0.00001)) {
    throw new Error('This recording appears to be silent. Add a recording with audible speech or paste its transcript.');
  }
  const transcriber = await loadTranscriber(onStatus);
  onStatus(`Transcribing ${file.name} on this device with Whisper…`);

  try {
    const result = await transcriber(file.pcm, { chunk_length_s: 25, stride_length_s: 4 });
    const text = normalise(result?.text || result);

    if (!text) {
      throw new Error("Whisper could not find any speech in this recording");
    }

    return text;
  } finally {
    await transcriber.dispose?.();
    transcriberPromise = null;
  }
}

function buildSource({ label, text, origin, adapter, warning = null }) {
  const document = normaliseDocument({ text });
  const clean = normalise(document.text);

  if (!clean) {
    return warning ? { label, text: "", origin, adapter, warning, blocks: [] } : null;
  }

  return {
    label,
    text: clean,
    origin,
    adapter,
    warning,
    blocks: document.blocks,
  };
}

export async function collectAudioSources({
  transcript,
  files = [],
  onStatus = () => {},
}) {
  const sources = [];
  const pasted = normalise(transcript);

  if (pasted) {
    sources.push(
      buildSource({
        label: "Audio transcript",
        text: pasted,
        origin: "paste",
        adapter: "audio-paste",
      })
    );
  }

  for (const file of files) {
    const kind = classifyAudioFile(file);

    try {
      if (kind === "unsupported") {
        throw new Error("this is not a recognised audio or transcript file");
      }

      if (kind === "transcript") {
        onStatus(`Reading the transcript in ${file.name}…`);
        sources.push(
          buildSource({
            label: file.name,
            text: stripSubtitleMarkup(await file.text()),
            origin: "transcript-file",
            adapter: "audio-paste",
          })
        );
        continue;
      }

      sources.push(
        buildSource({
          label: file.name,
          text: await transcribeAudioFile(file, onStatus),
          origin: "whisper",
          adapter: "whisper",
        })
      );
    } catch (error) {
      transcriberPromise = kind === "audio" ? null : transcriberPromise;
      sources.push({
        label: file.name,
        text: "",
        origin: "paste",
        adapter: "whisper",
        warning: `We could not transcribe ${file.name} (${error.message}). Any pasted transcript was kept.`,
        blocks: [],
      });
    }
  }

  return sources.filter(Boolean);
}

export async function collectAudioSource({ transcript, file, files, onStatus }) {
  const list = files || (file ? [file] : []);
  const collected = await collectAudioSources({ transcript, files: list, onStatus });

  if (!collected.length) {
    return null;
  }

  const withText = collected.find((source) => source.text);
  return withText || collected[0];
}
