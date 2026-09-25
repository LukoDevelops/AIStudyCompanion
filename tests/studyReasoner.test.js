import {afterEach, expect, it, vi} from 'vitest';
import {validateStudyResponse, reasonStudyPack} from '../src/adapters/studyReasoner.js';
import {selectStudyEvidence, studyValue} from '../src/pipeline/studyQuality.js';
const records=[{id:'one',sentence:'Active recall improves memory by retrieving information.',source:'Notes',index:1,heading:'Findings'}];
const valid=()=>({summary:[{text:'Retrieving information supports memory.',evidenceId:'one',quote:'Active recall improves memory'}],quiz:[{question:'How does active recall support memory?',choices:['Retrieving information','Avoiding all practice'],answer:'Retrieving information',explanation:'Recall involves retrieving information.',evidenceId:'one',quote:'by retrieving information'}]});
afterEach(()=>vi.unstubAllGlobals());
it('allows short, legitimate multiple-choice answers',()=>{
  const data=valid(); data.quiz[0].choices=['ATP','DNA']; data.quiz[0].answer='ATP';
  expect(validateStudyResponse(data,records).quiz[0].answer).toBe('ATP');
  expect(()=>validateStudyResponse(null,records)).toThrow(/incomplete pack/);
});
it('keeps verified source links on generated text',()=>expect(validateStudyResponse(valid(),records).quiz[0].evidenceId).toBe('one'));
it('rejects invented source IDs and quotes',()=>{
  const data=valid(); data.summary[0].evidenceId='invented'; expect(()=>validateStudyResponse(data,records)).toThrow(/unverified citation/);
  data.summary[0].evidenceId='one'; data.summary[0].quote='This was never written'; expect(()=>validateStudyResponse(data,records)).toThrow(/unverified citation/);
});
it('rejects corrupt output and choices without a matching answer',()=>{
  const data=valid(); data.quiz[0].answer='Other'; expect(()=>validateStudyResponse(data,records)).toThrow(/invalid question/);
  data.quiz[0].answer='Retrieving information'; data.summary[0].text='Corrupt \uFFFD output'; expect(()=>validateStudyResponse(data,records)).toThrow(/not usable/);
});
it('does not request a paid fallback when the free request fails', async ()=>{
  const mock=vi.fn().mockResolvedValue({ok:false,status:429}); vi.stubGlobal('fetch',mock);
  await expect(reasonStudyPack({sentenceRecords:records},'test-only-key',()=>{})).rejects.toThrow(/no paid fallback/); expect(mock).toHaveBeenCalledOnce();
});
it('requires a key before making a network request',async()=>{
  const mock=vi.fn(); vi.stubGlobal('fetch',mock);
  await expect(reasonStudyPack({sentenceRecords:records},'',()=>{})).rejects.toThrow(/requires/); expect(mock).not.toHaveBeenCalled();
});
it('deprioritises bibliographies and samples across sections',()=>{
  expect(studyValue({...records[0],heading:'References'})).toBeLessThan(0);
  const passages=Array.from({length:20},(_,i)=>({...records[0],id:String(i),heading:i<19?'Introduction':'Conclusion',section:i<19?'intro':'conclusion'}));
  expect(selectStudyEvidence(passages,{maxChars:1000,maxRecords:3}).some(r=>r.heading==='Conclusion')).toBe(true);
});
