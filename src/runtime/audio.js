import { classifyAudioFile } from '../adapters/audioAdapter.js';
import { LIMITS } from './limits.js';

function durationOf(file, signal) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      audio.onloadedmetadata = null; audio.onerror = null;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      const duration = audio.duration;
      audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
      error ? reject(error) : resolve(duration);
    };
    const abort = () => finish(new Error('Stopped. Your inputs are still available.'));
    const timer = setTimeout(() => finish(new Error(`Could not read the duration of ${file.name}. Try an MP3 or WAV clip, or paste its transcript.`)), 10000);
    signal?.addEventListener('abort', abort, {once:true});
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish();
    audio.onerror = () => finish(new Error(`This browser could not read ${file.name}. Try a WAV or MP3 file.`));
    audio.src = url;
  });
}

export async function prepareAudio(files, signal, onStatus) {
  const prepared = [];
  let totalSeconds = 0;
  for (const file of files) {
    signal.throwIfAborted();
    if (classifyAudioFile(file) !== 'audio') { prepared.push(file); continue; }
    onStatus(`Checking the length of ${file.name}…`);
    let duration;
    try { duration = await durationOf(file, signal); }
    catch (error) {
      signal.throwIfAborted();
      prepared.push({name:file.name,type:file.type,size:file.size,preparationError:error.message});
      continue;
    }
    if (!Number.isFinite(duration) || duration <= 0 || totalSeconds + duration > LIMITS.audioSeconds) throw new Error(`${file.name} is over the 30-minute recording budget or has no readable duration. Use a shorter recording or paste a transcript. The file was stopped before decoding.`);
    const context = new AudioContext({sampleRate:16000});
    try {
      let decoded;
      try { decoded = await boundedDecode(context, file, signal); }
      catch (error) {
        signal.throwIfAborted();
        prepared.push({name:file.name,type:file.type,size:file.size,preparationError:error.message});
        continue;
      }
      signal.throwIfAborted();
      totalSeconds += decoded.duration;
      if (totalSeconds > LIMITS.audioSeconds) throw new Error('The decoded audio is over the 30-minute total recording limit.');
      const pcm = new Float32Array(decoded.length);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const channel = decoded.getChannelData(c);
        for (let i=0;i<pcm.length;i++) pcm[i] += channel[i] / decoded.numberOfChannels;
      }
      prepared.push({name:file.name, type:file.type, size:file.size, pcm});
    } finally { await context.close(); }
  }
  return prepared;
}

function boundedDecode(context, file, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error('Audio preparation stopped.'));
    const timer = setTimeout(() => finish(new Error('Audio decoding took too long. Try a shorter clip or paste its transcript.')), 30000);
    signal.addEventListener('abort', abort, {once:true});
    if (signal.aborted) { abort(); return; }
    file.arrayBuffer().then(buffer => context.decodeAudioData(buffer)).then(value => finish(null, value), error => finish(error));
  });
}
