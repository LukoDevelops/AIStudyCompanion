import { LIMITS } from './limits.js';

export function runJob(payload, { signal, onStatus = () => {}, onStage = () => {}, timeoutMs = payload.inputs?.audioFiles?.some(file => file.pcm) ? LIMITS.audioTimeoutMs : LIMITS.timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Stopped. Your inputs are still available.'));
    const worker = new Worker(new URL('./processing.worker.js', import.meta.url), { type: 'module' });
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error('Stopped. Your inputs are still available.'));
    const timer = setTimeout(() => finish(new Error(`Processing exceeded the ${Math.round(timeoutMs / 60000)}-minute safety limit and was stopped. Try fewer files or shorter audio.`)), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (finished) return;
      // PDF.js initialises its fallback worker module in this worker's scope.
      // Its bootstrap notification is not an application pipeline message.
      if (data?.sourceName === 'worker' && data?.targetName === 'main' && data?.action === 'ready') return;
      if (!data || typeof data.type !== 'string') return finish(new Error('The processing worker returned an invalid message. Your previous results are unchanged.'));
      if (data.type === 'status') onStatus(data.value);
      if (data.type === 'stage') onStage(data.value);
      if (data.type === 'done') finish(null, data.value);
      if (data.type === 'error') finish(new Error(data.message));
    };
    worker.onerror = event => { event.preventDefault(); finish(new Error('The processing worker stopped unexpectedly. Try a smaller input or a lighter engine.')); };
    worker.onmessageerror = () => finish(new Error('The browser could not transfer this input. Try a smaller file.'));
    try {
      const buffers = (payload.inputs?.audioFiles || []).filter(file => file.pcm).map(file => file.pcm.buffer);
      worker.postMessage(payload, [...new Set(buffers)]);
    }
    catch { finish(new Error('The browser could not transfer this input. Try a smaller file.')); }
  });
}
