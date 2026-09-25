import { describe, it, expect } from 'vitest';
import { brierScore, buildFlashcards, createEvidenceSearch, createPracticeSession, practiceItemKey, updateLeitnerBox, weakerCardIndexes } from '../src/pipeline/studySession.js';
const quiz=[{question:'First?',choices:['A','B'],answer:'A',source:'Notes'},{question:'Second?',choices:['C','D'],answer:'D',source:'Audio'}];
describe('practice session',()=>{
  it('requires an answer, locks attempts and preserves first-attempt results after retry',()=>{
    const session=createPracticeSession(quiz);
    expect(session.next()).toBe(false);
    expect(session.answer('invalid')).toBeNull();
    expect(session.answer('B')).toBe(false);
    expect(session.answer('A')).toBeNull();
    session.next();session.answer('D');session.next();
    expect(session.current).toBeNull();
    expect(session.stats()).toMatchObject({firstCorrect:1,currentCorrect:1,missed:1,attempts:2});
    expect(session.retryMissed()).toBe(1);
    expect(session.current).toBe(0);
    session.answer('A');session.next();
    expect(session.stats()).toMatchObject({firstCorrect:1,currentCorrect:2,missed:0,attempts:3});
  });
  it('does not mutate source questions',()=>{
    const copy=JSON.stringify(quiz);const session=createPracticeSession(quiz);
    session.answer('A');session.next();session.retryMissed();
    expect(JSON.stringify(quiz)).toBe(copy);
  });
  it('handles empty decks and reports source-specific practice',()=>{
    expect(createPracticeSession([]).current).toBeNull();
    const session=createPracticeSession(quiz);session.answer('A');
    expect(session.sourceResults()).toEqual([{source:'Notes',total:1,attempted:1,correct:1},{source:'Audio',total:1,attempted:0,correct:0}]);
  });
  it('replaces a deck for a new round and records optional confidence',()=>{
    const session=createPracticeSession(quiz);
    session.setConfidence('sure');
    session.answer('A');
    expect(session.calibration()).toMatchObject({rated:1,brier:0,overconfident:0});
    const next=[{question:'Third?',choices:['E','F'],answer:'F',source:'Notes, sentence 2'}];
    expect(session.replaceDeck(next,{shuffleOrder:true,random:()=>0.999})).toBe(1);
    expect(session.current).toBe(0);
    expect(session.stats()).toMatchObject({attempted:0,firstCorrect:0});
    session.setConfidence('sure');
    session.answer('E');
    expect(session.calibration().overconfident).toBe(1);
    expect(session.sourceResults()[0].source).toBe('Notes');
    expect(session.missedItems()[0].question).toBe('Third?');
  });
  it('serialises and restores progress by evidence-backed question identity',()=>{
    const deck=[
      {question:'What is A?',answer:'A',choices:['A','B'],evidenceId:'s1'},
      {question:'What is B?',answer:'B',choices:['A','B'],evidenceId:'s2'},
    ];
    const first=createPracticeSession(deck);first.answer('A');first.next();const saved=first.snapshot();
    const restored=createPracticeSession(deck,{state:saved});
    expect(restored.current).toBe(1);expect(restored.stats().attempted).toBe(1);
    expect(saved.deck[0]).toBe(practiceItemKey(deck[0]));
    expect(createPracticeSession([{...deck[0],question:'Different'}],{state:saved}).current).toBe(0);
  });
});
it('computes Brier scores and Leitner boxes',()=>{
  expect(brierScore([])).toBeNull();
  expect(brierScore([{correct:true,confidence:1},{correct:false,confidence:0}])).toBe(0);
  expect(updateLeitnerBox(1,'ready')).toBe(2);
  expect(updateLeitnerBox(3,'ready')).toBe(3);
  expect(updateLeitnerBox(2,'again')).toBe(1);
  expect(weakerCardIndexes(3,new Map([[0,1],[1,3]]))).toEqual([0,2]);
});
const records=[{id:'a',source:'Notes',sentence:'Photosynthesis converts light energy into chemical energy.'},{id:'b',source:'Audio',sentence:'Respiration releases stored chemical energy.'},{id:'c',source:'Notes',sentence:'Chlorophyll absorbs sunlight.'}];
describe('evidence exploration',()=>{
  it('ranks matching records and filters source and citation state',()=>{
    const search=createEvidenceSearch(records,[{evidenceId:'a'}]);
    expect(search('photosynthesis')[0].record.id).toBe('a');
    expect(search('',{citation:'uncited'}).map(hit=>hit.record.id)).toEqual(['b','c']);
    expect(search('',{source:'Audio'}).map(hit=>hit.record.id)).toEqual(['b']);
    expect(search('absent term')).toEqual([]);
    expect(search('',{source:'Audio',citation:'cited'})).toEqual([]);
  });
  it('builds unique cards only from valid source records',()=>{
    const cards=buildFlashcards({corpus:{sentenceRecords:records},concepts:[{term:'Energy',evidenceId:'a'},{term:'energy',evidenceId:'b'},{term:'Bad',evidenceId:'missing'}]});
    expect(cards).toHaveLength(1);expect(cards[0].answer).toBe(records[0].sentence);
  });
});
