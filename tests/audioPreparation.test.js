import {afterEach, expect, it, vi} from 'vitest';
import {prepareAudio} from '../src/runtime/audio.js';
import {collectSources} from '../src/adapters/collect.js';
afterEach(()=>vi.unstubAllGlobals());
function setup(durations) {
  const close=vi.fn().mockResolvedValue();
  const decode=vi.fn().mockImplementation(async()=>({duration:durations[0],length:4,numberOfChannels:1,getChannelData:()=>new Float32Array([.1,.2,.3,.4])}));
  vi.stubGlobal('URL',{createObjectURL:()=> 'blob:test', revokeObjectURL:vi.fn()});
  vi.stubGlobal('Audio',class {duration=durations.shift(); removeAttribute(){} load(){} set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}});
  vi.stubGlobal('AudioContext',class {decodeAudioData=decode; close=close;});
  return {decode,close};
}
const file={name:'lecture.wav',size:63*1024**2,type:'audio/wav',arrayBuffer:async()=>new ArrayBuffer(8)};
it('keeps other study material when a recording cannot be decoded',async()=>{
  const {decode,close}=setup([20,20]);
  decode.mockRejectedValueOnce(new Error('Damaged recording'));
  const audioFiles=await prepareAudio([file,{name:'valid.vtt',text:async()=> 'Students retrieve information during active recall.'}],new AbortController().signal,()=>{});
  expect(audioFiles[0].preparationError).toBe('Damaged recording');
  expect(close).toHaveBeenCalledOnce();
  const {sources,warnings}=await collectSources({notes:'Retrieval practice strengthens memory through repeated recall.',description:'The diagram connects practice with memory.',audioFiles});
  expect(sources.map(s=>s.label)).toEqual(['Text notes','valid.vtt','Image description']);
  expect(warnings.join(' ')).toContain('Damaged recording');
});
it('keeps a warning when recording metadata is corrupt',async()=>{
  const {decode}=setup([]);
  vi.stubGlobal('Audio',class {removeAttribute(){} load(){} set src(value){queueMicrotask(()=>this.onerror?.());}});
  const result=await prepareAudio([file],new AbortController().signal,()=>{});
  expect(result[0].preparationError).toMatch(/could not read/);
  expect(decode).not.toHaveBeenCalled();
});
it('rejects excessive duration before decoding',async()=>{
  const {decode}=setup([1801]);
  await expect(prepareAudio([file],new AbortController().signal,()=>{})).rejects.toThrow(/30-minute/);
  expect(decode).not.toHaveBeenCalled();
});
it('prepares a recording above the old file limit and closes its context',async()=>{
  const {decode,close}=setup([420,420]);
  const prepared=await prepareAudio([file],new AbortController().signal,()=>{});
  expect(prepared[0].pcm).toHaveLength(4);
  expect(decode).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
});
it('keeps a total duration budget across files',async()=>{
  const {decode}=setup([1000,1000,1000]);
  await expect(prepareAudio([file,file],new AbortController().signal,()=>{})).rejects.toThrow(/30-minute/);
  expect(decode).toHaveBeenCalledOnce();
});
it('does not decode transcript files and stops before work when cancelled',async()=>{
  const {decode}=setup([]);
  expect(await prepareAudio([{name:'lecture.vtt'}],new AbortController().signal,()=>{})).toEqual([{name:'lecture.vtt'}]);
  const controller=new AbortController(); controller.abort();
  await expect(prepareAudio([file],controller.signal,()=>{})).rejects.toThrow();
  expect(decode).not.toHaveBeenCalled();
});
