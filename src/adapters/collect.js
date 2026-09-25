import { collectAudioSources } from "./audioAdapter.js";
import { collectImageSources } from "./imageAdapter.js";
import { collectTextSources } from "./textAdapter.js";

/** Sentence ids derive from the source label, so labels must stay unique. */
export function uniqueLabels(sources) {
  const seen = new Set();
  const reserved = new Set(sources.map(source => source.label));

  return sources.map((source) => {
    let label = source.label, suffix = 2;
    while (seen.has(label)) {
      do { label = `${source.label} (${suffix++})`; } while (reserved.has(label) || seen.has(label));
    }
    seen.add(label);
    return label === source.label ? source : {...source, label};
  });
}

export async function collectSources(inputs, onStatus = () => {}) {
  // Run model families sequentially to keep their peak memory use apart.
  const groups = [
    await collectTextSources({
      notes: inputs.notes,
      files: inputs.textFiles || [],
      onStatus,
    }),
    await collectAudioSources({
      transcript: inputs.transcript,
      files: inputs.audioFiles || [],
      onStatus,
    }),
    await collectImageSources({
      description: inputs.description,
      files: inputs.imageFiles || [],
      onStatus,
      useLocalCaption: inputs.useLocalCaption !== false,
      cloudKey: inputs.cloudVision ? inputs.cloudKey || "" : "",
      requireCloud: Boolean(inputs.cloudVision),
    }),
  ];

  const all = groups.flat();
  const usable = uniqueLabels(all.filter((source) => source && source.text));

  return {
    sources: usable,
    warnings: all.map((source) => source?.warning).filter(Boolean),
  };
}

export function warningsFrom(sources) {
  return sources.map((source) => source.warning).filter(Boolean);
}
