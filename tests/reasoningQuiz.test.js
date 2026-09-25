import { it, expect } from 'vitest';
import { runPipeline } from '../src/pipeline/orchestrator.js';
it('builds reasoning questions only from explicit source explanations',async()=>{
  const sources=[{label:'Science',text:'Leaves appear green because chlorophyll absorbs red and blue light. Water expands when frozen because its molecules form an open crystal structure. Evaporation is the conversion of liquid water into water vapour.'}];
  const pack=await runPipeline(sources,{engine:'local',pause:0});
  const questions=pack.quiz.filter(question=>question.type==='reasoning');
  expect(questions.length).toBeGreaterThan(0);
  for(const question of questions){
    expect(question.evidenceExcerpt.toLowerCase()).toContain('because');
    expect(question.evidenceExcerpt).toContain(question.answer);
    expect(question.choices).toContain(question.answer);
  }
});
it('does not fabricate a causal explanation for unrelated facts',async()=>{
  const pack=await runPipeline([{label:'Notes',text:'Leaves contain chlorophyll pigments. Water forms crystals when frozen. Evaporation changes liquid water into vapour.'}],{engine:'local',pause:0});
  expect(pack.quiz.some(question=>question.type==='reasoning')).toBe(false);
});
