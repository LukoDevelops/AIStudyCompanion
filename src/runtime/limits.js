export const LIMITS = { files: 16, totalBytes: 256 * 1024 ** 2, audioBytes: 100 * 1024 ** 2, imageBytes: 10 * 1024 ** 2, textBytes: 25 * 1024 ** 2, audioSeconds: 1800, characters: 600000, timeoutMs: 300000, audioTimeoutMs: 1800000 };

export function validateInputs(inputs) {
  const groups = [['text', inputs.textFiles || []], ['audio', inputs.audioFiles || []], ['image', inputs.imageFiles || []]];
  const all = groups.flatMap(([, files]) => files);
  if (all.length > LIMITS.files) throw new Error(`You can add up to ${LIMITS.files} files per run.`);
  if (all.reduce((sum, file) => sum + (file.size || 0), 0) > LIMITS.totalBytes) throw new Error('These files are over the 256 MB total limit. Try a smaller batch.');
  for (const [kind, files] of groups) for (const file of files) {
    if (file.size > LIMITS[`${kind}Bytes`]) throw new Error(`${file.name} is larger than the ${LIMITS[`${kind}Bytes`] / 1024 ** 2} MB ${kind} limit. Use a smaller file${kind === 'audio' ? ' or a transcript; recordings must total 30 minutes or less per run' : ''}. The run was stopped to keep the browser responsive.`);
  }
  if (['notes', 'transcript', 'description'].reduce((n, key) => n + (inputs[key]?.length || 0), 0) > LIMITS.characters) throw new Error('The pasted text is over 600,000 characters. Split it into smaller runs.');
}
