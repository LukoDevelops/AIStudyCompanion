// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadHistory,saveHistoryItem} from '../src/ui/history.js';
afterEach(()=>vi.restoreAllMocks());
beforeEach(()=>localStorage.clear());
it('ignores malformed storage instead of breaking app startup',()=>{
  for (const raw of ['null','{}','[null,{}]','not JSON']) {
    localStorage.setItem('aiStudyCompanion.history.v1',raw);
    expect(loadHistory()).toEqual([]);
  }
});
const pack = {generatedAt:'2026-09-17T12:00:00Z',engine:'local',sourceCount:1,summary:[],quiz:[],concepts:[],nextSteps:[],checks:{prototypeLimitations:[]},corpus:{sentenceRecords:[]}};
it('round-trips a valid saved pack',()=>{
  expect(saveHistoryItem(pack).saved).toBe(true);
  expect(loadHistory()[0].pack).toEqual(pack);
});
it('rejects malformed nested chart and integrity data without deleting storage',()=>{
  for (const extra of [{analytics:{graphEdges:{}}}, {checks:{prototypeLimitations:[],integrity:{issues:'bad'}}}]) {
    const raw=JSON.stringify([{pack:{...pack,...extra}}]);
    localStorage.setItem('aiStudyCompanion.history.v1',raw);
    expect(loadHistory()).toEqual([]);
    expect(localStorage.getItem('aiStudyCompanion.history.v1')).toBe(raw);
  }
});
it('rejects superficially valid packs missing their sentence store',()=>{
  localStorage.setItem('aiStudyCompanion.history.v1',JSON.stringify([{pack:{summary:[],quiz:[],concepts:[]}}]));
  expect(loadHistory()).toEqual([]);
});
it('reports quota failure without destroying existing saved data',()=>{
  saveHistoryItem(pack);
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  const result=saveHistoryItem({...pack,generatedAt:'2026-09-17T13:00:00Z'});
  expect(result.saved).toBe(false);
  expect(loadHistory()).toHaveLength(1);
  expect(loadHistory()[0].pack.generatedAt).toBe(pack.generatedAt);
});
