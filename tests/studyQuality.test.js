import {expect,it} from 'vitest';
import {runPipeline} from '../src/pipeline/orchestrator.js';
import {extractDocxText} from '../src/adapters/docxAdapter.js';
import {readFile} from 'node:fs/promises';
import {uniqueLabels} from '../src/adapters/collect.js';
import {selectStudyEvidence} from '../src/pipeline/studyQuality.js';
it('does not collide with existing numbered filenames',()=>{
  const labelled=uniqueLabels(['Notes','Notes','Notes (2)','Notes'].map(label=>({label})));
  expect(new Set(labelled.map(source=>source.label)).size).toBe(4);
});
it('reserves cloud evidence for other modalities even when a PDF has many sections',()=>{
  const records=Array.from({length:100},(_,i)=>({source:'PDF',section:`section-${i}`,sentence:'Research findings explain how plants convert light into stored chemical energy.'}));
  records.push({source:'Audio',sentence:'The lecturer explains how plant roots absorb water from soil.'},{source:'Image',sentence:'The diagram shows green leaves attached to a central stem.'});
  expect(new Set(selectStudyEvidence(records,{maxRecords:3}).map(record=>record.source)).size).toBe(3);
});
it.each(['local','baseline'])('represents later media after a long document in %s',async engine=>{
  const sources=[{label:'Paper',text:Array.from({length:1500},(_,i)=>`Research observation ${i} explains how plant leaves absorb sunlight for photosynthesis.`).join(' ')},{label:'Audio',text:'Roots absorb water and minerals from the surrounding soil.'},{label:'Image',text:'The diagram shows a central stem connecting roots with leaves.'}];
  const pack=await runPipeline(sources,{engine,pause:0});
  expect(pack.summary.some(item=>item.source.startsWith('Audio'))).toBe(true);
  expect(pack.summary.some(item=>item.source.startsWith('Image'))).toBe(true);
});
it('asks about explicit definitions, keeps unique evidence and avoids filename questions',async()=>{
  const pack=await runPipeline([{label:'Biology',text:'Photosynthesis is the process plants use to convert light into chemical energy. Respiration is the process cells use to release energy from glucose. Photosynthesis takes place inside chloroplasts in plant cells.'}],{pause:0});
  expect(pack.quiz.some(q=>q.type==='understanding')).toBe(true);
  expect(pack.quiz.some(q=>q.type==='source')).toBe(false);
  expect(new Set(pack.quiz.map(q=>q.evidenceId)).size).toBe(pack.quiz.length);
});
it('cleans escaped punctuation from actual Word imports',async()=>{
  const buffer=await readFile(new URL('../samples/text/nasa-ai-abstract.docx',import.meta.url));
  const text=await extractDocxText({arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)});
  expect(text).not.toMatch(/\\[.\-]/);
  expect(text).toContain('real-time');
});
it('represents multiple short sources in the summary',async()=>{
  const pack=await runPipeline([{label:'Plants',text:'Photosynthesis is how plants convert light into stored chemical energy. Chlorophyll absorbs sunlight inside the chloroplast.'},{label:'Cells',text:'Cellular respiration releases energy from glucose for cell activities. Mitochondria are the main site of aerobic respiration.'}],{pause:0});
  expect(pack.summary.some(s=>s.source.startsWith('Plants'))).toBe(true);
  expect(pack.summary.some(s=>s.source.startsWith('Cells'))).toBe(true);
});
