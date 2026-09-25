// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest';
import { renderWorkspace, resetWorkspace } from '../src/ui/studyWorkspace.js';
const record={id:'r1',source:'Notes',index:1,sentence:'A source sentence about retrieval.'};
const pack={engine:'local',sourceCount:1,summary:[{text:record.sentence,evidenceId:'r1'}],quiz:[{question:'Which method?',choices:['Retrieval','Guessing'],answer:'Retrieval',evidenceId:'r1',explanation:'Uses a source.'}],concepts:[{term:'Retrieval',evidenceId:'r1'}],corpus:{sentenceRecords:[record]},checks:{integrity:{issues:[],linkCoverage:100}},analytics:{coverage:{bySource:[{source:'Notes',used:1,total:1,pct:100}]}}};
const click=selector=>document.querySelector(selector).click();
beforeEach(()=>{
  resetWorkspace();
  document.body.innerHTML='<div id="tracePanel"></div><div id="insightsPanel"></div><div id="comparePanel" class="hidden"></div><section class="output-layout"></section>';
});
const keepOrder = { random: () => 0.999 };
const choose = label => [...document.querySelectorAll('[data-answer]')].find(button => button.querySelector('.choice-label')?.textContent === label).click();
const labels = () => [...document.querySelectorAll('.choice-label')].map(node => node.textContent);
it('filters actual evidence by every source and citation combination and preserves selections',()=>{
  const records=['Text notes','Audio transcript','Image description'].flatMap((source,i)=>[0,1].map(n=>({id:`s${i}-${n}`,source,index:n+1,sentence:`${source} ${n ? 'unused' : 'cited'} passage about retrieval.`})));
  const mixed={...pack,corpus:{sentenceRecords:records},summary:records.filter(r=>r.index===1).map(r=>({text:r.sentence,evidenceId:r.id})),quiz:[],concepts:[]};
  renderWorkspace(mixed,vi.fn(),keepOrder);click('[data-view="sources"]');
  const select=(id,value)=>{click(`[data-filter-select="${id}"] .filter-select-trigger`);click(`[data-filter-select="${id}"] [data-filter-value="${value}"]`);};
  for(const source of ['', 'Text notes','Audio transcript','Image description']) for(const citation of ['all','cited','uncited']) {
    select('deskSource',source);select('deskCitation',citation);
    const expected=records.filter(r=>(!source||r.source===source)&&(citation==='all'||(citation==='cited')===(r.index===1)));
    expect([...document.querySelectorAll('#searchResults .search-hit p')].map(n=>n.textContent).sort()).toEqual(expected.map(r=>r.sentence).sort());
  }
  click('[data-view="overview"]');click('[data-view="sources"]');
  expect(document.querySelector('#searchCount').textContent).toContain('1 matching sentence');
  expect(document.querySelector('[data-filter-select="deskSource"] .filter-select-value').textContent).toBe('Image description');
  const query=document.querySelector('#deskQuery');query.value='no-match';query.dispatchEvent(new Event('input'));
  expect(document.querySelector('#searchCount').textContent).toContain('0 matching sentences');
});
it('switches views without losing source outputs and resets visibility',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);
  expect(document.querySelector('.output-layout').hidden).toBe(true);
  click('[data-view="read"]');expect(document.querySelector('.output-layout').hidden).toBe(false);
  click('[data-view="explore"]');expect(document.querySelector('#insightsPanel').hidden).toBe(false);
  resetWorkspace();expect(document.querySelector('#studyWorkspace')).toBeNull();expect(document.querySelector('.output-layout').hidden).toBe(false);
});
it('preserves answers across views, completes rounds, and retries misses',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="practice"]');choose('Guessing');
  click('[data-view="overview"]');click('[data-view="practice"]');
  expect(document.querySelector('[data-answer="0"]').disabled).toBe(true);
  expect(document.querySelector('#practiceFeedback').textContent).toContain('Review this one');
  click('#nextQuestion');click('#retryMissed');choose('Retrieval');click('#nextQuestion');
  expect(document.querySelector('#practiceStage').textContent).toContain('0 of 1 correct on first attempt');
  expect(document.querySelector('#retryMissed')).toBeNull();
  expect(document.querySelector('#tryAgain')).not.toBeNull();
});
it('updates the first-attempt score as soon as an answer is submitted',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="practice"]');choose('Retrieval');
  expect(document.querySelector('.practice-position').textContent).toContain('1 correct on first attempt');
});
it('reveals source cards and opens searched evidence',()=>{
  const select=vi.fn();renderWorkspace(pack,select,keepOrder);click('[data-view="practice"]');click('[data-mode="cards"]');click('#revealCard');
  expect(document.querySelector('blockquote').textContent).toBe(record.sentence);
  click('#cardSource');expect(select).toHaveBeenCalledWith('r1');
  click('[data-view="sources"]');click('[data-hit="0"]');expect(select).toHaveBeenCalledWith('r1');
  const input=document.querySelector('#deskQuery');input.value='no-match';input.dispatchEvent(new Event('input'));
  expect(document.querySelector('#searchCount').textContent).toContain('0 matching');
});
it('renders untrusted source content as text, not markup',()=>{
  renderWorkspace({...pack,concepts:[{term:'<img src=x onerror=alert(1)>',evidenceId:'r1'}]},vi.fn(),keepOrder);
  click('[data-view="practice"]');click('[data-mode="cards"]');
  expect(document.querySelector('#practiceStage img')).toBeNull();
});
it('surfaces skipped-file warnings on the overview without HTML injection',()=>{
  renderWorkspace({...pack,checks:{...pack.checks,adapterWarnings:['large.pdf exceeds the limit','<img src=x>']}},vi.fn(),keepOrder);
  expect(document.querySelector('.workspace-import-warnings').textContent).toContain('large.pdf exceeds the limit');
  expect(document.querySelector('.workspace-import-warnings img')).toBeNull();
});
it('preserves evidence filters when returning from another view',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="sources"]');
  const query=document.querySelector('#deskQuery');query.value='retrieval';query.dispatchEvent(new Event('input'));
  click('[data-view="overview"]');click('[data-view="sources"]');
  expect(document.querySelector('#deskQuery').value).toBe('retrieval');
  expect(document.querySelector('#searchCount').textContent).toContain('1 matching');
});
it('uses accessible in-page source filters instead of native option popups',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="sources"]');
  expect(document.querySelectorAll('.source-search select')).toHaveLength(0);
  const usage=document.querySelector('[data-filter-select="deskCitation"]');
  const trigger=usage.querySelector('.filter-select-trigger');
  trigger.click();
  expect(usage.classList.contains('is-open')).toBe(true);
  expect(usage.querySelector('.filter-select-menu').hidden).toBe(false);
  usage.querySelector('[data-filter-value="cited"]').click();
  expect(trigger.textContent).toContain('Cited in this pack');
  expect(usage.classList.contains('is-open')).toBe(false);
  expect(document.querySelector('#searchCount').textContent).toContain('1 matching');
});
it('moves through source filters with keyboard controls',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="sources"]');
  const source=document.querySelector('[data-filter-select="deskSource"]');
  const trigger=source.querySelector('.filter-select-trigger');
  trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  expect(source.classList.contains('is-open')).toBe(true);
  expect(document.activeElement).toBe(source.querySelector('[role="option"]'));
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(source.classList.contains('is-open')).toBe(false);
  expect(document.activeElement).toBe(trigger);
});
it('does not keep the correct practice answer in a fixed slot',()=>{
  const pinned={...pack,quiz:[{question:'Which method?',choices:['Alpha','Retrieval','Bravo','Charlie'],answer:'Retrieval',evidenceId:'r1',explanation:'Uses a source.'}]};
  const positions=new Set();
  for(let i=0;i<30;i+=1){
    document.body.innerHTML='<div id="tracePanel"></div><div id="insightsPanel"></div><div id="comparePanel" class="hidden"></div><section class="output-layout"></section>';
    renderWorkspace(pinned,vi.fn());click('[data-view="practice"]');
    positions.add(labels().indexOf('Retrieval'));
    resetWorkspace();
  }
  expect(positions.size).toBeGreaterThan(1);
});
it('always offers try again after a finished round and restarts the same questions',()=>{
  renderWorkspace(pack,vi.fn(),keepOrder);click('[data-view="practice"]');choose('Retrieval');click('#nextQuestion');
  expect(document.querySelector('#tryAgain')).not.toBeNull();
  expect(document.querySelector('#newQuestions')).not.toBeNull();
  expect(document.querySelector('#retryMissed')).toBeNull();
  click('#tryAgain');
  expect(document.querySelector('#practiceStage').textContent).toContain('QUESTION 1 / 1');
  expect(document.querySelector('#workspaceStatus').textContent).toMatch(/reshuffled|same questions/i);
});
it('answers with number keys and builds a new unused-passage set',()=>{
  const unused={id:'r2',source:'Notes',index:2,sentence:'Chlorophyll absorbs sunlight and starts the photosynthetic reaction in chloroplasts.'};
  const extra={id:'r3',source:'Audio',index:1,sentence:'Cellular respiration releases stored chemical energy from glucose molecules during metabolism.'};
  const rich={
    ...pack,
    concepts:[...pack.concepts,{term:'Chlorophyll absorbs',evidenceId:'r2'},{term:'Cellular respiration',evidenceId:'r3'}],
    corpus:{sentenceRecords:[record,unused,extra]},
    analytics:{coverage:{bySource:[{source:'Notes',used:1,total:2,pct:50},{source:'Audio',used:0,total:1,pct:0}]}},
  };
  renderWorkspace(rich,vi.fn(),keepOrder);click('[data-view="practice"]');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
  expect(document.querySelector('#practiceFeedback').textContent).toContain('Correct');
  click('#nextQuestion');click('#newQuestions');
  expect(document.querySelector('#workspaceStatus').textContent).toMatch(/unused|new questions|remaining|reuses|enough/i);
  expect(document.querySelector('#practiceStage').textContent).not.toContain('ROUND COMPLETE');
});
it('offers new flashcards from leftover source passages',()=>{
  const unused={id:'r2',source:'Notes',index:2,sentence:'Chlorophyll absorbs sunlight and starts the photosynthetic reaction in chloroplasts.'};
  const rich={...pack,corpus:{sentenceRecords:[record,unused]},analytics:{coverage:{bySource:[{source:'Notes',used:1,total:2,pct:50}]}}};
  renderWorkspace(rich,vi.fn(),keepOrder);click('[data-view="practice"]');click('[data-mode="cards"]');click('#newCards');
  expect(document.querySelector('#workspaceStatus').textContent).toMatch(/card|uncited|unused|enough/i);
});
