import { collectSources } from '../adapters/collect.js';
import { extractTextForInsert } from '../adapters/textAdapter.js';
import { runPipeline } from '../pipeline/orchestrator.js';
import { compareEngines } from '../pipeline/compare.js';
import { polishQuizExplanations } from '../adapters/generationAdapter.js';
import { validateInputs, LIMITS } from './limits.js';

self.onmessage = async ({ data }) => {
  const onStatus = value => self.postMessage({ type: 'status', value });
  const onStage = value => self.postMessage({ type: 'stage', value });
  try {
    let value;
    if (data.action === 'preview') {
      validateInputs({ textFiles: [data.file] });
      value = await extractTextForInsert(data.file, onStatus);
      if (value.length > LIMITS.characters) throw new Error('The extracted text is over 600,000 characters. Split this document into smaller parts.');
    } else if (data.action === 'polish') {
      value = await polishQuizExplanations(data.pack, data.key, onStatus);
    } else {
      validateInputs(data.inputs);
      onStage('inputs');
      const { sources, warnings } = await collectSources(data.inputs, onStatus);
      if (!sources.length && warnings.length) throw new Error(warnings.join(' '));
      if (sources.reduce((n, source) => n + source.text.length, 0) > LIMITS.characters) throw new Error('The extracted content is too large. Split the documents into smaller runs.');
      const start = performance.now();
      value = data.action === 'compare'
        ? await compareEngines(sources, { onStatus, onStage, collectWarnings: warnings })
        : await runPipeline(sources, { engine: data.engine, cloudKey: data.inputs.cloudKey, onStatus, onStage, collectWarnings: warnings, pause: 0 });
      value.processingMs = Math.round(performance.now() - start);
    }
    self.postMessage({ type: 'done', value });
  } catch (error) { self.postMessage({ type: 'error', message: error.message || 'The material could not be processed.' }); }
};
