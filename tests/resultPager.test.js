// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {paginateList} from '../src/ui/resultPager.js';
it('pages without destroying answer state, and removes old controls on rerender',()=>{
  document.body.innerHTML='<ol id="quiz"><li><button disabled>Answered</button></li><li>Two</li><li>Three</li></ol>';
  const list=document.getElementById('quiz'); paginateList(list,2,'Quiz');
  expect(list.children[2].hidden).toBe(true);
  document.querySelector('#quiz-pages button:last-child').click();
  expect(list.children[0].hidden).toBe(true); expect(list.children[2].hidden).toBe(false); expect(list.start).toBe(3);
  document.querySelector('#quiz-pages button').click(); expect(list.querySelector('button').disabled).toBe(true);
  list.innerHTML='<li>Only</li>'; paginateList(list,2,'Quiz'); expect(document.getElementById('quiz-pages')).toBeNull();
});
