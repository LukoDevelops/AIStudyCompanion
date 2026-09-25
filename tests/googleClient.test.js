import {afterEach, expect, it, vi} from 'vitest';
import {googleGenerate, parseCloudJson, cloudError} from '../src/adapters/googleClient.js';
afterEach(()=> {vi.unstubAllGlobals(); vi.useRealTimers();});
it('distinguishes overload, quota and authentication errors',()=>{
  expect(cloudError(503).message).toMatch(/temporarily overloaded/);
  expect(cloudError(429).message).toMatch(/rate or quota/);
  expect(cloudError(403).message).toMatch(/denied access/);
});
it('joins visible text parts and ignores thought text',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'hidden'},{text:'Hello '},{text:'world'}]}}]})}));
  expect(await googleGenerate('test-key',{contents:[]})).toBe('Hello world');
});
it('rejects truncated results instead of treating them as malformed JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})}));
  await expect(googleGenerate('test-key',{})).rejects.toThrow(/response-length limit/);
});
it('retries transient errors on the same model, not quotas',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'OK'}]}}]})});
  vi.stubGlobal('fetch',fetcher);
  const result=googleGenerate('test-key',{});
  await vi.advanceTimersByTimeAsync(1100);
  expect(await result).toBe('OK');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0]);
});
it('accepts JSON fences but rejects broken JSON',()=>{
  expect(parseCloudJson('```json\n{"ok":true}\n```')).toEqual({ok:true});
  expect(()=>parseCloudJson('{')).toThrow(/incomplete JSON/);
});
