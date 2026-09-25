import {afterEach, describe, expect, it, vi} from 'vitest';
import {validateInputs, LIMITS} from '../src/runtime/limits.js';
import {runJob} from '../src/runtime/client.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('input protection', () => {
  it('accepts reported 13, 45 and 63 MB recordings and rejects over 100 MB', () => {
    for (const size of [13,45,63]) expect(() => validateInputs({audioFiles:[{name:'lecture.wav',size:size*1024**2}]})).not.toThrow();
    expect(() => validateInputs({audioFiles:[{name:'lecture.mp3',size:101*1024**2}]})).toThrow(/100 MB audio limit/);
  });
  it('rejects oversized images, documents, batches and pasted text', () => {
    expect(() => validateInputs({imageFiles:[{size:LIMITS.imageBytes+1}]})).toThrow(/image limit/);
    expect(() => validateInputs({textFiles:[{size:LIMITS.textBytes+1}]})).toThrow(/text limit/);
    expect(() => validateInputs({textFiles:Array(17).fill({size:1})})).toThrow(/16 files/);
    expect(() => validateInputs({audioFiles:Array(3).fill({size:90*1024**2})})).toThrow(/256 MB/);
    expect(() => validateInputs({notes:'x'.repeat(600001)})).toThrow(/600,000/);
  });
  it('accepts a normal mixed batch', () => expect(() => validateInputs({notes:'Study notes',audioFiles:[{size:1000}],imageFiles:[{size:2000}]})).not.toThrow());
});
describe('worker lifecycle', () => {
  let worker;
  function setup() {
    vi.stubGlobal('Worker', class { constructor() {worker=this;} terminate=vi.fn(); postMessage=vi.fn(); });
  }
  it('forwards status and releases a completed worker', async () => {
    setup(); const onStatus=vi.fn(); const promise=runJob({}, {onStatus});
    worker.onmessage({data:{type:'status',value:'Reading'}});
    worker.onmessage({data:{type:'done',value:{ok:true}}});
    expect(await promise).toEqual({ok:true}); expect(onStatus).toHaveBeenCalledWith('Reading'); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('transfers audio buffers rather than cloning them',async()=>{
    setup(); const pcm=new Float32Array(10);
    const promise=runJob({inputs:{audioFiles:[{pcm}]}});
    expect(worker.postMessage.mock.calls[0][1]).toEqual([pcm.buffer]);
    worker.onmessage({data:{type:'done',value:true}}); await promise;
  });
  it('terminates work on cancellation', async () => {
    setup(); const controller=new AbortController(); const promise=runJob({}, {signal:controller.signal});
    controller.abort(); await expect(promise).rejects.toThrow(/Stopped/); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('terminates a stalled worker on timeout', async () => {
    setup(); vi.useFakeTimers(); const promise=runJob({}, {timeoutMs:10});
    const assertion=expect(promise).rejects.toThrow(/safety limit/); await vi.advanceTimersByTimeAsync(11); await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('reports a worker crash and cleans up', async () => {
    setup(); const promise=runJob({}); worker.onerror({preventDefault:vi.fn()});
    await expect(promise).rejects.toThrow(/unexpectedly/); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('ignores late messages after cancellation', async () => {
    setup(); const controller=new AbortController(), onStatus=vi.fn();
    const promise=runJob({}, {signal:controller.signal,onStatus});
    controller.abort();
    worker.onmessage({data:{type:'status',value:'Late progress'}});
    await expect(promise).rejects.toThrow(/Stopped/);
    expect(onStatus).not.toHaveBeenCalled();
  });
  it('handles malformed worker messages without hanging', async () => {
    setup(); const promise=runJob({}); worker.onmessage({data:null});
    await expect(promise).rejects.toThrow(/invalid message/);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('ignores PDF.js bootstrap notifications without ending the job', async () => {
    setup(); const promise=runJob({});
    worker.onmessage({data:{sourceName:'worker',targetName:'main',action:'ready',data:null}});
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.onmessage({data:{type:'done',value:'PDF extracted'}});
    expect(await promise).toBe('PDF extracted');
  });
});
