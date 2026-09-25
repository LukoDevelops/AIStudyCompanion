import { describe, it, expect } from 'vitest';
import { auditIntegrity } from '../src/pipeline/integrity.js';
import { buildCoverage } from '../src/pipeline/coverage.js';
import { buildChecks } from '../src/pipeline/checks.js';

const corpus = { sources: [{label:'Notes'}, {label:'Audio'}], sentenceRecords: [
  {id:'n1', source:'Notes', sentence:'Retrieval ranks relevant passages.', tokens:['retrieval','ranks','relevant','passages']},
  {id:'a1', source:'Audio', sentence:'Evaluation measures system behaviour.', tokens:['evaluation','measures','system','behaviour']},
] };
describe('structural evidence integrity', () => {
  it('rejects dangling citations instead of counting truthy IDs', () => {
    const summary = [{text:'Something', evidenceId:'absent'}];
    expect(auditIntegrity(corpus, {summary}).linkCoverage).toBe(0);
    expect(buildChecks(corpus, summary, []).groundingCoverage).toBe(0);
    expect(buildCoverage(corpus, summary).coveragePct).toBe(0);
  });
  it('counts unique valid coverage only', () => {
    expect(buildCoverage(corpus, [{evidenceId:'n1'}, {evidenceId:'n1'}, {evidenceId:'bad'}]).coveragePct).toBe(50);
  });
  it('matches normalized literal quotations without claiming entailment', () => {
    const audit = auditIntegrity(corpus, {summary:[{text:'A claim', evidenceId:'n1', evidenceExcerpt:'RETRIEVAL   ranks'}]});
    expect(audit.quoteMatchPct).toBe(100);
    expect(audit.uncitedSources).toEqual(['Audio']);
  });
  it('reports wrong-source quotations', () => {
    const audit = auditIntegrity(corpus, {summary:[{text:'A claim', evidenceId:'n1', evidenceExcerpt:'Evaluation measures'}]});
    expect(audit.issues.map(i => i.code)).toContain('quote-mismatch');
  });
  it.each([
    {choices:['A'], answer:'A', code:'invalid-choices'},
    {choices:['A',' a '], answer:'A', code:'invalid-choices'},
    {choices:['A','B'], answer:'C', code:'invalid-answer'},
    {choices:['A',''], answer:'A', code:'invalid-choices'},
  ])('rejects malformed quiz $code', ({choices, answer, code}) => {
    expect(auditIntegrity(corpus, {quiz:[{question:'Which?', evidenceId:'n1', choices, answer}]}).issues.map(i => i.code)).toContain(code);
  });
  it('detects duplicate and damaged output', () => {
    const summary = ['Repeated','Repeated','Damaged \uFFFD'].map(text => ({text,evidenceId:'n1'}));
    expect(auditIntegrity(corpus, {summary}).issues.map(i => i.code)).toEqual(['duplicate-output','damaged-text']);
  });
  it('does not invent a quotation score for empty inputs', () => {
    const result = auditIntegrity({sentenceRecords:[]});
    expect(result.quoteMatchPct).toBeNull();
    expect(result.linkCoverage).toBe(0);
  });
});
