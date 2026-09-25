import { expect, it, vi } from 'vitest';
vi.mock('../src/adapters/visionAdapter.js',()=>({describeImage:vi.fn().mockRejectedValue(new Error('Invalid image bytes'))}));
import {collectSources} from '../src/adapters/collect.js';
import {runPipeline} from '../src/pipeline/orchestrator.js';

it.each(['document','audio','image','all'])('keeps valid lanes and warning provenance with corrupt %s input',async kind=>{
  const inputs={notes:'Retrieval practice strengthens memory by recalling information. Spaced practice separates review sessions over time.',transcript:'Feedback helps students correct mistakes after a quiz.',description:'The diagram connects recall, feedback, and review.'};
  if(kind==='document'||kind==='all') inputs.textFiles=[new File(['bad zip'],'broken.docx')];
  if(kind==='audio'||kind==='all') inputs.audioFiles=[{name:'broken.wav',type:'audio/wav',preparationError:'Invalid audio bytes'}];
  if(kind==='image'||kind==='all') inputs.imageFiles=[new File(['bad image'],'broken.png',{type:'image/png'})];
  const {sources,warnings}=await collectSources(inputs);
  expect(sources.map(s=>s.label)).toEqual(['Text notes','Audio transcript','Image description']);
  expect(warnings).toHaveLength(kind==='all'?3:1);
  const pack=await runPipeline(sources,{pause:0,collectWarnings:warnings});
  expect(pack.checks.integrity.issues).toEqual([]);
  expect(pack.checks.adapterWarnings).toEqual(expect.arrayContaining(warnings));
  expect(pack.summary.length).toBeGreaterThan(0);
});
