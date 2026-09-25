import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { collectSources } from '../src/adapters/collect.js';
import { runPipeline } from '../src/pipeline/orchestrator.js';
import { validateInputs } from '../src/runtime/limits.js';

const path = name => new URL(`../samples/${name}`,import.meta.url);
const file = name => {const data=readFileSync(path(name));return {name:name.split('/').at(-1),size:data.length,type:'',text:async()=>data.toString('utf8'),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const manifestData = name => {
  const data = readFileSync(path(name));
  return /\.(docx|pdf|mp3|wav|jpg|jpeg|png|webp)$/i.test(name)
    ? data
    : Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
};
describe('mixed sample library regressions',()=>{
  it('keeps every ordinary sample within its per-file input limit',()=>{
    for(const entry of JSON.parse(readFileSync(path('manifest.json'),'utf8'))){
      if(!/^(audio|images|text)\//.test(entry.file)) continue;
      const key=entry.file.startsWith('images/')?'imageFiles':entry.file.startsWith('audio/')?'audioFiles':'textFiles';
      expect(()=>validateInputs({[key]:[file(entry.file)]}),entry.file).not.toThrow();
    }
  });
  it('verifies every shipped file against its manifest',()=>{
    for(const entry of JSON.parse(readFileSync(path('manifest.json'),'utf8'))){
      const data=manifestData(entry.file);
      expect(data.length,entry.file).toBe(entry.bytes);
      expect(createHash('sha256').update(data).digest('hex'),entry.file).toBe(entry.sha256);
    }
  });
  it.each(['baseline','local'])('keeps five real imported source files in %s output',async engine=>{
    const {sources,warnings}=await collectSources({textFiles:['text/nasa-ai-abstract.docx','text/nasa-ai-exploration.txt','text/nasa-ai-abstract.md'].map(file),audioFiles:['text/apollo-landing-site.vtt','text/apollo-landing-site.srt'].map(file)});
    expect(sources).toHaveLength(5);expect(warnings).toHaveLength(0);
    expect(sources.map(s=>s.text).join(' ')).not.toMatch(/align:start|NOTE This|cue-1|-->/);
    const pack=await runPipeline(sources,{engine,pause:0});
    expect(pack.sources).toHaveLength(5);
    expect(pack.checks.integrity.issues).toEqual([]);
  });
  it('keeps usable text and reports corrupt Word files',async()=>{
    const {sources,warnings}=await collectSources({textFiles:['edge-cases/corrupt.docx','text/nasa-ai-abstract.md'].map(file)});
    expect(sources).toHaveLength(1);expect(warnings.join(' ')).toContain('corrupt.docx could not be read');
  });
  it('reports empty files rather than silently dropping them',async()=>{
    const {sources,warnings}=await collectSources({textFiles:[file('edge-cases/empty.txt')]});
    expect(sources).toHaveLength(0);expect(warnings.join(' ')).toContain('empty.txt contained no readable');
  });
  it('retains the important negation and Unicode numbers',async()=>{
    const {sources}=await collectSources({textFiles:[file('edge-cases/negation-and-unicode.txt')]});
    expect(sources[0].text).toContain('not 28');
    expect(sources[0].text).toContain('does not prove a spacecraft fault');
    expect(sources[0].text).not.toContain('�');
  });
  it('does not repeat summary points or questions across duplicate transcripts',async()=>{
    const {sources}=await collectSources({textFiles:[file('text/nasa-ai-abstract.docx')],audioFiles:[file('text/apollo-landing-site.vtt'),file('text/apollo-landing-site.txt')]});
    const pack=await runPipeline(sources,{engine:'local',pause:0});
    expect(new Set(pack.summary.map(item=>item.text.toLowerCase())).size).toBe(pack.summary.length);
    expect(new Set(pack.quiz.map(item=>item.question.toLowerCase())).size).toBe(pack.quiz.length);
    expect(pack.checks.integrity.issues).toEqual([]);
  });
});
