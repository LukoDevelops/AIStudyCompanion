import { buildFlashcards, CONFIDENCE_LEVELS, createEvidenceSearch, createPracticeSession, updateLeitnerBox, weakerCardIndexes } from '../pipeline/studySession.js';
import { buildFollowUpCards, buildPracticeSet, relatedFollowUp, sourceName, weakSources } from '../pipeline/practiceBank.js';
import { labelQuizType, randomizeQuizChoiceOrder } from '../pipeline/quiz.js';
import { buildStudyPlan, studyReadiness } from '../pipeline/studyPlan.js';
import { buildStudyAudit } from '../pipeline/studyAudit.js';
import { escapeHtml as e } from '../pipeline/text.js';
import { engineName } from './engines.js';
import { loadStudyProgress, saveStudyProgress } from './studyProgress.js';

let activeWorkspace = null;
let detachWorkspace = null;
export function openWorkspaceView(view) { activeWorkspace?.open(view); }
export function resetWorkspace() {
  detachWorkspace?.();
  detachWorkspace = null;
  activeWorkspace = null;
  document.getElementById('studyWorkspace')?.remove();
  document.querySelectorAll('[data-workspace-hidden]').forEach(node=>{node.hidden=false;delete node.dataset.workspaceHidden;});
}

function filterSelectMarkup(id, label, options) {
  const listId = `${id}Options`;
  return `<div class="filter-control"><span class="filter-control-label" id="${e(id)}Label">${e(label)}</span><div class="filter-select" data-filter-select="${e(id)}"><button type="button" class="filter-select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="${e(listId)}"><span class="filter-select-value"></span><span class="filter-select-chevron" aria-hidden="true"></span></button><div class="filter-select-menu" id="${e(listId)}" role="listbox" aria-labelledby="${e(id)}Label" tabindex="-1" hidden>${options.map((option, index) => `<button type="button" role="option" class="filter-select-option" id="${e(id)}Option${index}" data-filter-value="${e(option.value)}" aria-selected="false" tabindex="-1">${e(option.label)}</button>`).join('')}</div></div></div>`;
}

export function renderWorkspace(pack, onEvidence, options = {}) {
  resetWorkspace();
  const output = document.querySelector('.output-layout');
  if (!output) return;
  const rng = options.random || Math.random;
  const host=document.createElement('section');
  host.id='studyWorkspace'; host.className='study-workspace panel';
  const shell=document.querySelector('.app-shell');
  if(shell) shell.prepend(host); else document.getElementById('tracePanel')?.before(host);
  const views=[['overview','Overview'],['read','Read'],['practice','Practice'],['explore','Explore'],['sources','Sources'],['inputs','Edit inputs']];
  const recordLookup=new Map(pack.corpus.sentenceRecords.map(record=>[record.id,record]));
  const withSources=(quiz)=>quiz.map(item=>({...item,source:recordLookup.get(item.evidenceId)?.source || sourceName(item)}));
  let practiceQuiz = withSources(randomizeQuizChoiceOrder(pack.quiz, rng));
  const savedProgress=loadStudyProgress(pack);
  const practice=createPracticeSession(practiceQuiz,{state:savedProgress?.practice});
  let cards=buildFlashcards(pack);
  let seenPractice=[...practiceQuiz];
  let lastReport=null;
  let lastPracticeSources=[];
  const search=createEvidenceSearch(pack.corpus.sentenceRecords,[...pack.summary,...pack.concepts,...pack.quiz]);
  let flashIndex=Math.min(Math.max(0,Number(savedProgress?.flashIndex)||0),Math.max(0,cards.length-1)), flashRevealed=false, searchPage=0, mode=savedProgress?.mode==='cards'?'cards':'quiz', currentView='overview';
  const searchFilters={query:'',source:'',citation:'all'};
  const ratings=new Map(savedProgress?.ratings || []);
  const boxes=new Map(savedProgress?.boxes || []);
  const persistProgress=(view=currentView)=>saveStudyProgress(pack,{view,mode,flashIndex,practice:practice.snapshot(),ratings:[...ratings],boxes:[...boxes]});
  host.innerHTML=`<div class="workspace-heading"><div><p class="eyebrow">YOUR STUDY DESK</p><h2>Everything you need to study from your material.</h2><p class="muted">${e(engineName(pack.engine))} · ${pack.sourceCount} source${pack.sourceCount === 1 ? '' : 's'} · Start with the evidence, then test yourself.</p></div><sl-badge class="workspace-label" pill variant="success">SOURCE-LINKED PACK</sl-badge></div>
    <sl-button-group class="workspace-nav" label="Study workspace">${views.map(([id,label], index)=>`<sl-button type="button" class="workspace-nav-item" data-view="${id}" aria-pressed="false"><span class="nav-index">${String(index + 1).padStart(2,'0')}</span><span>${label}</span></sl-button>`).join('')}</sl-button-group>
    <p id="workspaceStatus" class="workspace-status" role="status"></p><p id="workspaceError" class="error-banner hidden" role="alert"></p><div id="workspaceBody"></div>`;
  const body=host.querySelector('#workspaceBody');
  const external=[document.getElementById('tracePanel'),document.getElementById('insightsPanel'),document.getElementById('comparePanel'),output];
  const show=(node,visible)=>{if(node){node.hidden=!visible;node.dataset.workspaceHidden='true';}};
  const evidence=(id)=>onEvidence(id);

  function filterOptions(root) {
    return [...root.querySelectorAll('.filter-select-option')];
  }
  function closeFilterMenus(except = null) {
    body.querySelectorAll('.filter-select.is-open').forEach(root=>{
      if (root === except) return;
      root.classList.remove('is-open');
      root.querySelector('.filter-select-trigger')?.setAttribute('aria-expanded','false');
      root.querySelector('.filter-select-menu')?.setAttribute('hidden','');
    });
  }
  function syncFilterSelect(key) {
    const root=body.querySelector(`[data-filter-select="${key}"]`);
    if (!root) return;
    const options=filterOptions(root);
    const field=key==='deskSource' ? 'source' : 'citation';
    const selected=options.find(option=>option.dataset.filterValue===searchFilters[field]) || options[0];
    if (!selected) return;
    searchFilters[field]=selected.dataset.filterValue;
    root.querySelector('.filter-select-value').textContent=selected.textContent;
    options.forEach(option=>{
      const active=option===selected;
      option.setAttribute('aria-selected',String(active));
      option.tabIndex=active ? 0 : -1;
    });
  }
  function openFilterMenu(root, focusIndex = null) {
    closeFilterMenus(root);
    root.classList.add('is-open');
    root.querySelector('.filter-select-trigger')?.setAttribute('aria-expanded','true');
    root.querySelector('.filter-select-menu')?.removeAttribute('hidden');
    const options=filterOptions(root);
    const selectedIndex=options.findIndex(option=>option.getAttribute('aria-selected')==='true');
    const index=focusIndex === null ? Math.max(0,selectedIndex) : Math.min(Math.max(0,focusIndex),Math.max(0,options.length-1));
    options[index]?.focus();
  }
  function moveFilterFocus(root, direction) {
    const options=filterOptions(root);
    const current=options.indexOf(document.activeElement);
    const next=Math.min(Math.max(0,current + direction),Math.max(0,options.length-1));
    options[next]?.focus();
  }
  function chooseFilterOption(root, option) {
    const key=root.dataset.filterSelect;
    searchFilters[key==='deskSource' ? 'source' : 'citation']=option.dataset.filterValue;
    syncFilterSelect(key);
    closeFilterMenus();
    root.querySelector('.filter-select-trigger')?.focus();
    searchPage=0;
    updateSearch();
  }
  function onFilterClick(event) {
    const target=event.target;
    const option=target?.closest?.('.filter-select-option');
    if (option && body.contains(option)) {
      chooseFilterOption(option.closest('.filter-select'),option);
      return;
    }
    const trigger=target?.closest?.('.filter-select-trigger');
    if (!trigger || !body.contains(trigger)) return;
    const root=trigger.closest('.filter-select');
    if (root.classList.contains('is-open')) closeFilterMenus();
    else openFilterMenu(root);
  }
  function onFilterKey(event) {
    const target=event.target;
    const trigger=target?.closest?.('.filter-select-trigger');
    const option=target?.closest?.('.filter-select-option');
    const control=trigger || option;
    if (!control || !body.contains(control)) return;
    const root=control.closest('.filter-select');
    const options=filterOptions(root);
    if (event.key==='Escape') {
      event.preventDefault();
      closeFilterMenus();
      root.querySelector('.filter-select-trigger')?.focus();
      return;
    }
    if (event.key==='Tab') {
      closeFilterMenus();
      return;
    }
    if (event.key==='Enter' || event.key===' ') {
      event.preventDefault();
      if (trigger) {
        if (root.classList.contains('is-open')) closeFilterMenus();
        else openFilterMenu(root);
      } else chooseFilterOption(root,option);
      return;
    }
    if (event.key==='ArrowDown' || event.key==='ArrowUp') {
      event.preventDefault();
      const direction=event.key==='ArrowDown' ? 1 : -1;
      if (!root.classList.contains('is-open')) openFilterMenu(root);
      else moveFilterFocus(root,direction);
      return;
    }
    if (event.key==='Home' || event.key==='End') {
      event.preventDefault();
      if (!root.classList.contains('is-open')) openFilterMenu(root,event.key==='Home' ? 0 : options.length-1);
      else options[event.key==='Home' ? 0 : options.length-1]?.focus();
    }
  }
  function onFilterOutside(event) {
    if (!event.target?.closest?.('.filter-select')) closeFilterMenus();
  }
  body.addEventListener('click',onFilterClick);
  body.addEventListener('keydown',onFilterKey);
  document.addEventListener('pointerdown',onFilterOutside);
  function setDeskStatus(message) {
    const node=host.querySelector('#workspaceStatus');
    if (node) node.textContent=message || '';
  }
  function open(view) {
    currentView=view;
    host.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    external.forEach(node=>show(node,view==='read' ? node===output : view==='explore' ? node!==output : false));
    show(document.querySelector('.work-grid'),view==='inputs');
    show(document.querySelector('.hero'),false);
    show(document.getElementById('quizList')?.closest('.result-card'),false);
    body.innerHTML='';
    if(view==='overview') overview();
    if(view==='practice') renderPractice();
    if(view==='sources') renderSearch();
    if(view==='inputs') body.innerHTML='<p class="workspace-hint">Your current pack stays here while you edit the inputs. A new pack gets its own practice history, and reopening this one can pick up where you left off.</p>';
    if(view==='read') body.innerHTML='<p class="workspace-hint">Start with the takeaways below. Each source tag opens the passage behind it. Use Practice for focused questions and flashcards.</p>';
    if(view==='explore') {body.innerHTML='<p class="workspace-hint">Use these charts to explore coverage and relationships. A connection means shared wording or context—not a proven cause-and-effect link.</p>';window.dispatchEvent(new Event('resize'));}
    persistProgress(view);
  }
  activeWorkspace={open};
  host.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.view)));
  function overview() {
    const integrity=pack.checks.integrity;
    const sources=pack.analytics?.coverage?.bySource || [];
    const stats=practice.stats();
    const readiness=studyReadiness(pack,{practice:stats,cardsReviewed:ratings.size});
    const audit=buildStudyAudit(pack,{practice:stats,cardsReviewed:ratings.size});
    const plan=buildStudyPlan(pack,{practice:stats,cardsReviewed:ratings.size});
    const auditVariant=audit.tone==='clear'?'success':audit.tone==='watch'?'warning':'danger';
    const modalityLabels=[['text','Text'],['audio','Audio'],['image','Images']].filter(([key])=>readiness.modalities[key]).map(([key,label])=>`${readiness.modalities[key]} ${label}`).join(' · ') || 'No labelled source lanes';
    body.innerHTML=`<div class="desk-metrics">${[[pack.summary.length,'key takeaways'],[pack.quiz.length,'practice questions'],[cards.length,'review cards'],[pack.corpus.sentenceRecords.length,'source sentences kept']].map(([value,label])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      <section class="readiness-console"><div class="readiness-summary"><div class="readiness-gauge" style="--readiness:${readiness.score}%"><strong>${readiness.score}</strong><span>/100</span></div><div><p class="eyebrow">SESSION READINESS</p><h3>${e(readiness.label)}</h3><p>${e(readiness.explanation)}</p><small>${e(modalityLabels)} · ${stats.attempted}/${stats.total} practice questions started</small></div></div><div class="readiness-metrics">${readiness.metrics.map(metric=>`<div><span>${e(metric.label)}</span><strong>${metric.value}${metric.suffix}</strong></div>`).join('')}</div></section>
      <section class="audit-console" aria-label="Evidence audit"><div class="audit-heading"><div><p class="eyebrow">TRACEABILITY AUDIT</p><h3>What this pack can back up</h3><p>${e(audit.summary)}</p></div><sl-badge class="audit-score is-${audit.tone}" variant="${auditVariant}" pill>${audit.score}/100 · ${e(audit.label)}</sl-badge></div><div class="audit-grid">${audit.checks.map(check=>`<button type="button" class="audit-check is-${check.tone}" data-audit-view="${e(check.view)}"><span class="audit-check-top"><strong>${e(check.label)}</strong><b>${e(check.value)}</b></span><span>${e(check.detail)}</span><small>${check.tone==='clear'?'Looks good':check.tone==='watch'?'Worth a closer look':'Needs attention'}</small></button>`).join('')}</div></section>
      <div class="protocol-header"><div><p class="eyebrow">ADAPTIVE STUDY PLAN</p><h3>A useful next step</h3></div><span class="muted">Your progress is saved in this browser.</span></div><ol class="study-protocol">${plan.map(step=>`<li class="protocol-step is-${step.state}"><button type="button" data-plan-view="${step.view}"><span class="protocol-number">${step.number}</span><span class="protocol-copy"><small>${e(step.label)}</small><strong>${e(step.title)}</strong><em>${e(step.detail)}</em></span><b>${step.state==='complete'?'Finished':step.state==='attention'?'Review':'Start here'}</b></button></li>`).join('')}</ol>
      <div class="desk-columns"><section class="desk-start"><p class="eyebrow">A SIMPLE WAY THROUGH</p><h3>Read. Recall. Check the source.</h3><p>Start with the key ideas, try a few questions without looking, then return to the source whenever something feels unclear.</p><button type="button" data-start="read">Start with the summary</button> <button type="button" class="secondary" data-start="practice">Try a few questions</button><p class="muted">Your answers, flashcard ratings, and current view are saved in this browser.</p></section>
      <section class="desk-health"><h3>Before you trust a result</h3><p>${integrity ? `${integrity.issues.length} structural issue(s) need attention. ${integrity.linkCoverage}% of outputs have a valid source link.` : 'This older pack has no structural audit yet. Build it again to see the latest checks.'}</p><p>Source links and matching quotations help you trace an answer, but they are not full fact-checking.</p><button type="button" class="secondary" data-start="sources">Browse the source material</button></section></div>
      <div class="desk-section-heading"><h3>Your source collection</h3><span class="muted">Cited / kept sentences</span></div><div class="source-collection">${sources.map((source,index)=>{
        const practiceNote=lastPracticeSources.find(row=>row.source===source.source);
        const weak=practiceNote && practiceNote.attempted && practiceNote.correct<practiceNote.attempted;
        return `<button type="button" class="source-collection-item${weak ? ' is-weak' : ''}" data-source-index="${index}"><span class="source-number">${String(index+1).padStart(2,'0')}</span><strong>${e(source.source)}</strong><span>${source.used} of ${source.total} sentences cited</span>${practiceNote ? `<span class="source-practice-note">${weak ? 'Worth another look in practice' : 'Practice round complete'} · ${practiceNote.correct}/${practiceNote.attempted} currently correct</span>` : ''}<meter min="0" max="100" value="${source.pct}" aria-label="${e(source.source)} sentence coverage"></meter></button>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-start],[data-plan-view]').forEach(button=>button.onclick=()=>open(button.dataset.start || button.dataset.planView));
    body.querySelectorAll('[data-audit-view]').forEach(button=>button.onclick=()=>open(button.dataset.auditView));
    if (pack.checks.adapterWarnings?.length) {
      const warning = document.createElement('section');
      warning.className='workspace-import-warnings';
      warning.innerHTML=`<h3>Take a look at your imported material</h3><p>Some items were skipped, sampled, or need a review. This pack may not include everything you added.</p><ul>${pack.checks.adapterWarnings.map(message=>`<li>${e(message)}</li>`).join('')}</ul>`;
      body.prepend(warning);
    }
    body.querySelectorAll('[data-source-index]').forEach(button=>button.onclick=()=>{searchFilters.query='';searchFilters.citation='all';searchFilters.source=sources[Number(button.dataset.sourceIndex)].source;searchPage=0;open('sources');});
  }
  function traceMarkup(report) {
    if (!report) return '';
    return `<details class="practice-trace"><summary>How these questions were chosen</summary>
      <ul>
        <li>Selection method: ${e(report.selection || 'unused-first MMR')}</li>
        <li>Answer choices: ${e(report.distractorMethod || 'bm25-evidence')}</li>
        <li>Unused sentences available: ${report.unusedAvailable ?? '—'}; used here: ${report.unusedUsed ?? '—'}</li>
        <li>New wording vs. earlier questions: ${report.unique ?? '—'}; reused evidence: ${report.reused ?? '—'}</li>
        ${report.graphFollowUp ? '<li>The follow-up used nearby ideas from the concept graph.</li>' : ''}
        ${report.preferSources?.length ? `<li>Preferred sources: ${e(report.preferSources.join(', '))}</li>` : ''}
      </ul>
      <p class="muted">${e(report.message || '')}</p>
    </details>`;
  }
  function applyDeck(quiz, report) {
    lastReport = report;
    setDeskStatus(report?.message || '');
    if (!quiz.length) {
      renderQuestion();
      return false;
    }
    seenPractice = [...seenPractice, ...quiz];
    practiceQuiz = withSources(quiz);
    practice.replaceDeck(practiceQuiz);
    persistProgress('practice');
    renderPractice();
    return true;
  }
  function renderPractice() {
    body.innerHTML=`<div class="practice-toolbar"><sl-button-group label="Practice mode"><sl-button type="button" size="small" data-mode="quiz" aria-pressed="${mode==='quiz'}">Questions</sl-button><sl-button type="button" size="small" data-mode="cards" aria-pressed="${mode==='cards'}">Flashcards</sl-button></sl-button-group><span class="practice-keys muted">${mode==='quiz' ? 'Keyboard: 1–4 answer · N next · E source' : 'Keyboard: R reveal · N / P move · 1 another look · 2 ready'}</span></div><div id="practiceStage" aria-live="polite"></div>`;
    body.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;persistProgress('practice');renderPractice();});
    mode==='quiz' ? renderQuestion() : renderCard();
  }
  function renderQuestion() {
    const stage=body.querySelector('#practiceStage');
    if (!stage) return;
    const stats=practice.stats(), id=practice.current;
    if(id===null) {
      lastPracticeSources=practice.sourceResults();
      const cal=practice.calibration();
      const weak=weakSources(lastPracticeSources);
      const missed=practice.missedItems();
      stage.innerHTML=`<div class="practice-card"><p class="eyebrow">ROUND COMPLETE</p><h3>${stats.firstCorrect} of ${stats.attempted} correct on first attempt</h3><p>${stats.missed} question(s) could use another look. You made ${stats.attempts} attempt(s) in total.</p><p class="muted">This is a practice result, not a validated measure of learning.</p>
        ${cal.rated ? `<p>Brier score: ${cal.brier} across ${cal.rated} confidence rating(s). Lower is closer to 0. You had ${cal.overconfident} over-confident miss(es). This is a calibration statistic, not a psychology instrument.</p>` : '<p class="muted">You skipped the optional confidence ratings, so there is no Brier score to show.</p>'}
        ${lastReport ? `<p class="practice-notice" role="status">${e(lastReport.message)}</p>` : ''}
        <div class="practice-actions">
          <button type="button" id="tryAgain">Try again</button>
          ${stats.missed ? '<button type="button" id="retryMissed" class="secondary">Try missed questions again</button>' : ''}
          <button type="button" id="newQuestions" class="secondary">Build new questions</button>
          ${weak.length ? '<button type="button" id="weakFollowUp" class="secondary">Practice weaker sources</button>' : ''}
          ${missed.length ? '<button type="button" id="relatedFollowUp" class="secondary">Try related ideas</button>' : ''}
        </div>
        ${traceMarkup(lastReport)}
        <div class="practice-breakdown">${lastPracticeSources.map(row=>`<p><strong>${e(row.source)}</strong><span>${row.correct}/${row.attempted} right so far · ${row.total} question(s)</span></p>`).join('')}</div></div>`;
      stage.querySelector('#tryAgain').onclick=()=>{
        practiceQuiz=randomizeQuizChoiceOrder(practiceQuiz, rng);
        practice.replaceDeck(practiceQuiz,{shuffleOrder:true,random:rng});
        lastReport={selection:'reshuffle-same-deck',distractorMethod:'unchanged',message:'Same questions, new order. Your first-try score starts fresh for this round.'};
        setDeskStatus(lastReport.message);
        persistProgress('practice');
        renderPractice();
      };
      stage.querySelector('#retryMissed')?.addEventListener('click',()=>{practice.retryMissed();persistProgress('practice');renderQuestion();});
      stage.querySelector('#newQuestions').onclick=()=>applyDeck(...(()=>{const built=buildPracticeSet(pack,{exclude:seenPractice,limit:Math.max(3,pack.quiz.length||5),random:rng});return [built.quiz,built.report];})());
      stage.querySelector('#weakFollowUp')?.addEventListener('click',()=>{
        const built=buildPracticeSet(pack,{exclude:seenPractice,preferSources:weak,limit:Math.max(3,pack.quiz.length||5),random:rng});
        applyDeck(built.quiz,built.report);
      });
      stage.querySelector('#relatedFollowUp')?.addEventListener('click',()=>{
        const built=relatedFollowUp(pack,missed,{exclude:seenPractice,limit:Math.max(3,pack.quiz.length||5),random:rng});
        applyDeck(built.quiz,built.report);
      });
      return;
    }
    const item=practice.items()[id];
    const confidence=CONFIDENCE_LEVELS.map(level=>`<button type="button" class="secondary" data-confidence="${level.id}" aria-pressed="false">${e(level.label)}</button>`).join('');
    stage.innerHTML=`<div class="practice-card"><div class="practice-position"><span>QUESTION ${practice.position+1} / ${practice.length}</span><span>${stats.firstCorrect} correct on first attempt</span></div><progress max="${practice.length}" value="${practice.position}" aria-label="Round progress"></progress><p class="muted">${e(labelQuizType(item.type))} · ${e(item.source)}</p><h3>${e(item.question)}</h3><div class="practice-confidence" role="group" aria-label="Optional confidence"><span>How sure are you?</span>${confidence}</div><div class="practice-choices">${item.choices.map((choice,index)=>`<button type="button" data-answer="${index}" ${practice.revealed?'disabled':''}><span class="choice-key" aria-hidden="true">${index+1}</span><span class="choice-label">${e(choice)}</span></button>`).join('')}</div><div id="practiceFeedback"></div></div>`;
    function feedback(correct) {
      stage.querySelector('.practice-position span:last-child').textContent=`${practice.stats().firstCorrect} correct on first attempt`;
      stage.querySelector('#practiceFeedback').innerHTML=`<div class="practice-feedback"><strong>${correct ? 'Correct.' : 'Review this one.'}</strong><p>Answer: ${e(item.answer)}</p><p>${e(item.explanation || 'Open the linked source passage to check it.')}</p><button type="button" class="secondary" id="practiceEvidence">Open the source</button> <button type="button" id="nextQuestion">${practice.position+1===practice.length?'Finish round':'Next question'}</button></div>`;
      stage.querySelector('#practiceEvidence').onclick=()=>evidence(item.evidenceId);
      stage.querySelector('#nextQuestion').onclick=()=>{practice.next();persistProgress('practice');renderQuestion();};
    }
    // Re-entering the view preserves answers; it never grants another first attempt.
    if(practice.revealed) feedback(practice.lastCorrect);
    stage.querySelectorAll('[data-confidence]').forEach(button=>button.onclick=()=>{
      if (practice.revealed) return;
      practice.setConfidence(button.dataset.confidence);
      persistProgress('practice');
      stage.querySelectorAll('[data-confidence]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
    });
    stage.querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>{
      const correct=practice.answer(item.choices[Number(button.dataset.answer)]);
      if (correct==null) return;
      persistProgress('practice');
      stage.querySelectorAll('[data-answer]').forEach(choiceButton=>{choiceButton.disabled=true;choiceButton.classList.toggle('answer-correct',item.choices[Number(choiceButton.dataset.answer)]===item.answer);});feedback(correct);
    });
  }
  function renderCard() {
    const stage=body.querySelector('#practiceStage');
    if (!stage) return;
    const card=cards[flashIndex];
    if(!card){stage.innerHTML='<p>There aren’t enough linked concepts for flashcards yet.</p>';return;}
    const box=boxes.get(flashIndex)||1;
    const weaker=weakerCardIndexes(cards.length,boxes);
    stage.innerHTML=`<div class="practice-card flashcard"><p class="eyebrow">CARD ${flashIndex+1} OF ${cards.length} · ${ratings.size} REVIEWED · LEITNER BOX ${box} / 3</p><h3>${e(card.prompt)}</h3><p class="muted">Try explaining it before you reveal the source. Box 1 comes back sooner; box 3 means the idea feels more familiar. This is a simple in-session schedule, not a validated spaced-repetition study.</p>${flashRevealed?`<blockquote>${e(card.answer)}</blockquote><p class="muted">${e(card.source)} · This is the original passage, not a definition written by the app.</p><div class="button-row"><button type="button" id="cardSource" class="secondary">Open the source</button><button type="button" data-rating="again">Needs another look</button><button type="button" data-rating="ready">Ready for now</button></div>`:'<button type="button" id="revealCard">Reveal the source</button>'}<div class="flashcard-navigation"><button type="button" class="secondary" id="prevCard" ${flashIndex===0?'disabled':''}>Previous card</button><span>${ratings.get(flashIndex)==='again'?'Marked for another look':ratings.has(flashIndex)?'Marked ready for now':'Not reviewed yet'}</span><button type="button" class="secondary" id="nextCard" ${flashIndex===cards.length-1?'disabled':''}>Next card</button></div>
      <div class="practice-actions">
        <button type="button" id="newCards" class="secondary">New flashcards</button>
        ${weaker.length && ratings.size ? '<button type="button" id="reviewWeaker" class="secondary">Review weaker cards</button>' : ''}
      </div>
      ${lastReport ? `<p class="practice-notice" role="status">${e(lastReport.message)}</p>` : ''}
      ${traceMarkup(lastReport)}
      <p class="muted">${[...ratings.values()].filter(v=>v==='again').length} card(s) marked for another look. Your ratings are not test scores.</p></div>`;
    stage.querySelector('#revealCard')?.addEventListener('click',()=>{flashRevealed=true;persistProgress('practice');renderCard();});
    stage.querySelector('#cardSource')?.addEventListener('click',()=>evidence(card.evidenceId));
    stage.querySelector('#prevCard').onclick=()=>{flashIndex--;flashRevealed=false;persistProgress('practice');renderCard();};
    stage.querySelector('#nextCard').onclick=()=>{flashIndex++;flashRevealed=false;persistProgress('practice');renderCard();};
    stage.querySelectorAll('[data-rating]').forEach(button=>button.onclick=()=>{
      boxes.set(flashIndex, updateLeitnerBox(boxes.get(flashIndex), button.dataset.rating));
      ratings.set(flashIndex,button.dataset.rating);
      if(flashIndex<cards.length-1)flashIndex++;
      flashRevealed=false;persistProgress('practice');renderCard();
    });
    stage.querySelector('#newCards').onclick=()=>{
      const built=buildFollowUpCards(pack,{exclude:cards,limit:8});
      lastReport=built.report;
      setDeskStatus(built.report.message);
      if (!built.cards.length) { renderCard(); return; }
      cards=built.cards;
      flashIndex=0; flashRevealed=false; ratings.clear(); boxes.clear();
      persistProgress('practice');
      renderPractice();
    };
    stage.querySelector('#reviewWeaker')?.addEventListener('click',()=>{
      flashIndex=weaker[0] ?? 0;
      flashRevealed=false;
      setDeskStatus(`Showing ${weaker.length} card(s) that you marked for another look.`);
      persistProgress('practice');
      renderCard();
    });
  }
  function renderSearch() {
    const sources=[...new Set(pack.corpus.sentenceRecords.map(record=>record.source))];
    body.innerHTML=`<div class="source-search"><label class="search-control">Search your sources<input id="deskQuery" type="search" placeholder="Find a concept, result, or phrase…" maxlength="500"></label>${filterSelectMarkup('deskSource','Source',[{value:'',label:'All sources'},...sources.map(source=>({value:source,label:source}))])}${filterSelectMarkup('deskCitation','Usage',[{value:'all',label:'All sentences'},{value:'cited',label:'Cited in this pack'},{value:'uncited',label:'Not cited yet'}])}</div><p class="muted">Search the sentences kept from your materials. This view helps you find evidence; it does not write new answers.</p><p id="searchCount" role="status"></p><div id="searchResults"></div><div id="searchPages" class="result-pages"></div>`;
    body.querySelector('#deskQuery').value=searchFilters.query;
    syncFilterSelect('deskSource');
    syncFilterSelect('deskCitation');
    body.querySelector('#deskQuery').addEventListener('input',()=>{searchPage=0;updateSearch();});
    updateSearch();
  }
  function updateSearch() {
    searchFilters.query=body.querySelector('#deskQuery').value;
    const results=search(searchFilters.query,{source:searchFilters.source,citation:searchFilters.citation});
    searchPage=Math.min(searchPage,Math.max(0,Math.ceil(results.length/8)-1));
    const pageCount=Math.max(1,Math.ceil(results.length/8));
    const sentenceLabel=results.length===1 ? '1 matching sentence' : `${results.length} matching sentences`;
    body.querySelector('#searchCount').textContent=`${sentenceLabel} · Page ${searchPage+1} of ${pageCount}`;
    const shown=results.slice(searchPage*8,searchPage*8+8);
    body.querySelector('#searchResults').innerHTML=shown.length?shown.map((hit,index)=>`<article class="search-hit"><div><strong>${e(hit.record.source)}</strong><span>${hit.cited?'Cited in this pack':'Not cited yet'} · sentence ${hit.record.index}</span></div><p>${e(hit.record.sentence)}</p><button type="button" class="secondary" data-hit="${index}">Open the source passage</button></article>`).join(''):'<p class="empty-state">Nothing matched those filters. Try fewer words or clear one filter.</p>';
    body.querySelectorAll('[data-hit]').forEach(button=>button.onclick=()=>evidence(shown[Number(button.dataset.hit)].record.id));
    body.querySelector('#searchPages').innerHTML=`<button type="button" id="searchPrev" ${searchPage===0?'disabled':''}>Previous</button><button type="button" id="searchNext" ${(searchPage+1)*8>=results.length?'disabled':''}>Next</button>`;
    body.querySelector('#searchPrev').onclick=()=>{searchPage--;updateSearch();};
    body.querySelector('#searchNext').onclick=()=>{searchPage++;updateSearch();};
  }
  function onPracticeKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (typeof event.target?.closest === 'function' && event.target.closest('input, textarea, select')) return;
    if (host.querySelector('[data-view][aria-pressed="true"]')?.dataset.view !== 'practice') return;
    const stage=body.querySelector('#practiceStage');
    if (!stage) return;
    const key=event.key;
    if (mode==='quiz') {
      if (!practice.revealed && /^[1-4]$/.test(key)) {
        const button=stage.querySelector(`[data-answer="${Number(key)-1}"]`);
        if (button && !button.disabled) { event.preventDefault(); button.click(); }
        return;
      }
      if (practice.revealed && (key==='n' || key==='N' || key==='Enter')) {
        const next=stage.querySelector('#nextQuestion');
        if (next) { event.preventDefault(); next.click(); }
        return;
      }
      if (practice.revealed && (key==='e' || key==='E')) {
        stage.querySelector('#practiceEvidence')?.click();
        event.preventDefault();
      }
      return;
    }
    if ((key==='r' || key==='R' || key===' ') && stage.querySelector('#revealCard')) {
      event.preventDefault();
      stage.querySelector('#revealCard').click();
      return;
    }
    if (key==='n' || key==='N') stage.querySelector('#nextCard')?.click();
    if (key==='p' || key==='P') stage.querySelector('#prevCard')?.click();
    if (key==='1') stage.querySelector('[data-rating="again"]')?.click();
    if (key==='2') stage.querySelector('[data-rating="ready"]')?.click();
  }
  document.addEventListener('keydown', onPracticeKey);
  detachWorkspace=()=>{
    document.removeEventListener('keydown', onPracticeKey);
    document.removeEventListener('pointerdown',onFilterOutside);
    body.removeEventListener('click',onFilterClick);
    body.removeEventListener('keydown',onFilterKey);
  };
  const availableViews=new Set(views.map(([id])=>id));
  open(savedProgress?.view && availableViews.has(savedProgress.view) ? savedProgress.view : 'overview');
  if (savedProgress) setDeskStatus('Your study progress was restored from this browser.');
}
