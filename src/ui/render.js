import { groundingHistogram } from "../pipeline/coverage.js";
import { labelQuizType, randomizeQuizChoiceOrder, scoreQuiz } from "../pipeline/quiz.js";
import { escapeHtml } from "../pipeline/text.js";
import {
  barChartSvg,
  bindChartTooltips,
  conceptGraphSvg,
  donutSvg,
  histogramSvg,
} from "./charts.js";
import { createGraph3d } from "./graph3d.js";
import { hydrateIcons } from "./icons.js";
import { paginateList } from "./resultPager.js";
import { engineName } from "./engines.js";
import { createPager } from "./pager.js";
import { renderWorkspace, resetWorkspace, openWorkspaceView } from './studyWorkspace.js';

let activeTrigger = null;
let quizAnswers = [];
let evidencePager = null;
let evidenceRecords = [];
let graph3d = null;
let latestPack = null;

const chartState = { coverageMode: "count", bins: 5, minWeight: 1 };

export function setActiveStage(stage) {
  document.querySelectorAll(".pipeline li").forEach((item) => {
    item.classList.toggle("active", item.dataset.stage === stage);
  });
}

export function showError(message) {
  const error = document.getElementById("formError");
  error.textContent = message;
  error.classList.toggle("hidden", !message);
  const workspaceError=document.getElementById('workspaceError');
  if(workspaceError){workspaceError.textContent=message;workspaceError.classList.toggle('hidden',!message);}
}

export function setStatus(message) {
  const status = document.getElementById("adapterStatus");

  if (status) {
    status.textContent = message || "";
  }
  const workspaceStatus=document.getElementById('workspaceStatus');
  if(workspaceStatus) workspaceStatus.textContent=message || '';
}

function paintEvidenceSelection(evidenceId) {
  document.querySelectorAll("#evidenceList [data-evidence-id]").forEach((node) => {
    const selected = node.dataset.evidenceId === evidenceId;
    node.classList.toggle("is-selected", selected);
    node.setAttribute("aria-current", selected ? "true" : "false");
  });

  const list = document.getElementById("evidenceList");
  list?.classList.toggle("is-filtered", Boolean(evidenceId));

  const cssEscape =
    globalThis.CSS?.escape || ((value) => String(value).replace(/"/g, '\\"'));
  const selected = document.querySelector(
    `#evidenceList [data-evidence-id="${cssEscape(evidenceId || "")}"]`
  );

  if (typeof selected?.scrollIntoView === "function") {
    selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

export function selectEvidence(evidenceId, trigger = null) {
  openWorkspaceView('read');
  document.querySelectorAll(".is-active-trigger").forEach((node) => {
    node.classList.remove("is-active-trigger");
  });

  if (trigger) {
    trigger.classList.add("is-active-trigger");
    activeTrigger = trigger;
  }

  // The sentence may live on another page, so bring that page into view first.
  evidencePager?.revealId(evidenceId);
  paintEvidenceSelection(evidenceId);
}

function bindEvidenceTrigger(node, evidenceId) {
  if (!node || !evidenceId) {
    return;
  }

  node.dataset.evidenceId = evidenceId;
  node.setAttribute("role", "button");
  node.tabIndex = 0;
  node.title = "Show the source passage";
  const activate = () => selectEvidence(evidenceId, node);
  node.addEventListener("click", activate);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
}

function groundingChips(item) {
  if (typeof item.groundingScore !== "number") {
    return "";
  }

  const chips = [
    ["Grounding", `${item.groundingScore}%`],
    ["Overlap", `${item.overlapScore}%`],
    ["Retrieval", `${item.retrievalScore}%`],
  ];

  if (typeof item.f1Score === "number") {
    chips.push(["F1", `${item.f1Score}%`]);
  }

  return `<span class="chip-row">${chips
    .map(
      ([label, value]) =>
        `<span class="grounding-chip"><span class="chip-key">${label}</span>${value}</span>`
    )
    .join("")}</span>`;
}

function sectionTag(item) {
  return item.section
    ? `<span class="section-tag">${escapeHtml(item.section)}</span>`
    : "";
}

function renderEvidencePage(records, meta) {
  const list = document.getElementById("evidenceList");
  const status = document.getElementById("pagerStatus");
  list.innerHTML = "";
  list.classList.remove("is-filtered");

  records.forEach((record, offset) => {
    const item = document.createElement("li");
    item.dataset.evidenceId = record.id;
    item.setAttribute("aria-current", "false");
    item.innerHTML = `
      <strong>${escapeHtml(record.source)}, sentence ${record.index}</strong>
      ${record.heading ? `<span class="section-tag">${escapeHtml(record.heading)}</span>` : ""}
      <p>${escapeHtml(record.sentence)}</p>
      <span class="evidence-ordinal">#${meta.start + offset + 1}</span>
    `;
    list.appendChild(item);
  });

  if (status) {
    status.textContent = meta.label;
  }

  document.querySelectorAll("[data-page-step]").forEach((button) => {
    const step = button.dataset.pageStep;
    const atStart = meta.page <= 1;
    const atEnd = meta.page >= meta.pages;
    button.disabled =
      step === "first" || step === "prev" ? atStart : atEnd;
  });

  const pageJump = document.getElementById("pageJump");
  const sentenceJump = document.getElementById("sentenceJump");

  if (pageJump) {
    pageJump.max = String(meta.pages);
    pageJump.placeholder = `1-${meta.pages}`;
  }

  if (sentenceJump) {
    sentenceJump.max = String(meta.total);
    sentenceJump.placeholder = `1-${meta.total}`;
  }
}

export function renderEvidence(records) {
  evidenceRecords = records || [];

  if (!evidencePager) {
    evidencePager = createPager({ onRender: renderEvidencePage });
  }

  evidencePager.setItems(evidenceRecords);
}

export function bindEvidenceControls() {
  document.querySelectorAll("[data-page-step]").forEach((button) => {
    button.addEventListener("click", () => {
      evidencePager?.step(button.dataset.pageStep);
    });
  });

  const jump = () => {
    const pageJump = document.getElementById("pageJump");
    const sentenceJump = document.getElementById("sentenceJump");
    const sentence = Number(sentenceJump?.value);
    const page = Number(pageJump?.value);

    if (Number.isFinite(sentence) && sentence > 0) {
      evidencePager?.revealIndex(sentence - 1);
      const record = evidenceRecords[sentence - 1];

      if (record) {
        paintEvidenceSelection(record.id);
      }

      return;
    }

    if (Number.isFinite(page) && page > 0) {
      evidencePager?.go(page);
    }
  };

  document.getElementById("jumpBtn")?.addEventListener("click", jump);

  ["pageJump", "sentenceJump"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jump();
      }
    });
  });
}

export function renderSummary(summary) {
  const summaryList = document.getElementById("summaryList");
  summaryList.innerHTML = "";

  summary.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <p class="summary-text">${escapeHtml(item.text)}</p>
      ${sectionTag(item)}
      <span class="source-tag">${escapeHtml(item.source)} · ${["vision", "cloud-vision"].includes(item.origin) ? "Model observation — check image" : `${escapeHtml(item.confidence)} source relevance`}</span>
      ${groundingChips(item)}
    `;
    bindEvidenceTrigger(li.querySelector(".source-tag"), item.evidenceId);
    summaryList.appendChild(li);
  });
}

export function renderConcepts(concepts) {
  const conceptList = document.getElementById("conceptList");
  conceptList.innerHTML = "";

  concepts.forEach((concept) => {
    const node = document.getElementById("conceptTemplate").content.cloneNode(true);
    node.querySelector("strong").textContent = concept.term;
    node.querySelector("span").textContent = `Score ${concept.score} · ${concept.source}`;
    node.querySelector(".related").textContent = [
      concept.related?.length ? `Related: ${concept.related.join(", ")}` : "",
      concept.pageRank ? `Rank ${concept.pageRank}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    bindEvidenceTrigger(node.querySelector(".concept-pill"), concept.evidenceId);
    conceptList.appendChild(node);
  });
}

export function renderQuiz(quiz) {
  const quizList = document.getElementById("quizList");
  const scoreNode = document.getElementById("quizScore");
  quizList.innerHTML = "";
  quizAnswers = Array.from({ length: quiz.length }, () => null);

  if (scoreNode) {
    scoreNode.textContent =
      "Choose an answer for each question. The source tag still opens the supporting sentence.";
  }

  const displayQuiz = randomizeQuizChoiceOrder(quiz);
  displayQuiz.forEach((item, index) => {
    const li = document.createElement("li");
    const choices = (item.choices || [])
      .map(
        (choice) =>
          `<button type="button" class="quiz-choice" data-quiz-index="${index}" data-choice="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`
      )
      .join("");

    li.innerHTML = `
      <p class="quiz-type">${escapeHtml(labelQuizType(item.type))}</p>
      <p class="quiz-question">${escapeHtml(item.question)}</p>
      <div class="choice-row">${choices}</div>
      <span class="source-tag">Source: ${escapeHtml(item.source)}</span>
      <p class="quiz-explain hidden" data-explain="${index}">${escapeHtml(item.explanation)} Answer: ${escapeHtml(item.answer)}</p>
      ${groundingChips(item)}
    `;
    bindEvidenceTrigger(li.querySelector(".source-tag"), item.evidenceId);
    quizList.appendChild(li);
  });

  quizList.querySelectorAll(".quiz-choice").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.quizIndex);
      quizAnswers[index] = button.dataset.choice;
      const question = quiz[index];

      button.parentElement.querySelectorAll(".quiz-choice").forEach((choice) => {
        choice.disabled = true;
        choice.classList.toggle("is-correct", choice.dataset.choice === question.answer);
        choice.classList.toggle(
          "is-wrong",
          choice === button && choice.dataset.choice !== question.answer
        );
      });

      document.querySelector(`[data-explain="${index}"]`)?.classList.remove("hidden");
      const scored = scoreQuiz(quiz, quizAnswers);
      const answered = quizAnswers.filter((value) => value !== null).length;

      if (scoreNode) {
        scoreNode.textContent = `Score so far: ${scored.correct} of ${answered} answered`;
      }
    });
  });
}

export function renderNextSteps(nextSteps) {
  const nextStepsList = document.getElementById("nextStepsList");
  nextStepsList.innerHTML = "";

  nextSteps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    nextStepsList.appendChild(li);
  });
}

export function renderChecks(checks) {
  const rows = [
    ["Evidence links", `${checks.groundingCoverage}% of outputs link to an existing source sentence (not a factual accuracy score)`],
    ["Mean grounding", `${checks.meanGroundingScore || 0}% average overlap and retrieval score`],
    ["Engine", engineName(checks.engine || "local")],
    ["Retrieval", checks.retrieval || "baseline-keywords"],
    ["Sentence coverage", `${checks.coveragePct || 0}% of source sentences were cited`],
    ["Sources processed", String(checks.sourceCount)],
    ["Sentences processed", String(checks.sentenceCount)],
    ["Concepts extracted", String(checks.conceptCount)],
  ];

  if (checks.integrity) {
    rows.push(['Quotation matches', checks.integrity.quoteMatchPct === null ? 'No quotations to check' : `${checks.integrity.quoteMatchPct}% match their cited sentence`]);
    rows.push(['Sources represented', `${checks.integrity.sourceRepresentationPct}% of retained sources cited`]);
    rows.push(['Structural review', `${checks.integrity.issues.length} issue(s); human review is still needed`]);
    for (const issue of checks.integrity.issues.slice(0, 8)) {
      rows.push([`${issue.section} ${issue.index + 1}`, issue.message]);
    }
  }

  document.getElementById("checks").innerHTML = `
    ${rows
      .map(
        ([label, value]) =>
          `<div class="metric-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`
      )
      .join("")}
    <div class="metric-row">
      <strong>Limits</strong>
      <span>${checks.prototypeLimitations.map(escapeHtml).join("<br>")}</span>
    </div>
  `;
}

export function renderCompare(comparison) {
  const panel = document.getElementById("comparePanel");
  const table = document.getElementById("compareTable");

  if (!panel || !table || !comparison) {
    return;
  }

  const rows = [
    ["Engine", comparison.baseline.engine, comparison.local.engine],
    ["Retrieval", comparison.baseline.retrieval, comparison.local.retrieval],
    ["Concepts", comparison.baseline.conceptCount, comparison.local.conceptCount],
    ["Summary points", comparison.baseline.summaryCount, comparison.local.summaryCount],
    ["Quiz questions", comparison.baseline.quizCount, comparison.local.quizCount],
    ["Quiz types", comparison.baseline.quizTypes, comparison.local.quizTypes],
    ['Pipeline time (this run, excluding file reading)', `${comparison.baseline.durationMs ?? '—'} ms`, `${comparison.local.durationMs ?? '—'} ms`],
    ['Structural issues', comparison.baseline.structuralIssues ?? 'Not measured', comparison.local.structuralIssues ?? 'Not measured'],
    ['Sources represented', `${comparison.baseline.sourceRepresentationPct ?? '—'}%`, `${comparison.local.sourceRepresentationPct ?? '—'}%`],
    ["Mean grounding", `${comparison.baseline.meanGrounding}%`, `${comparison.local.meanGrounding}%`],
    ["Sentence coverage", `${comparison.baseline.coveragePct || 0}%`, `${comparison.local.coveragePct || 0}%`],
    [
      "Overlapping concept phrases",
      comparison.baseline.duplicatePhrases,
      comparison.local.duplicatePhrases,
    ],
  ];

  table.innerHTML = rows
    .map(
      ([label, left, right]) =>
        `<div class="compare-row"><strong>${escapeHtml(label)}</strong><span><em>${escapeHtml(engineName(comparison.baseline.engine))}</em> ${escapeHtml(left)}</span><span><em>${escapeHtml(engineName(comparison.local.engine))}</em> ${escapeHtml(right)}</span></div>`
    )
    .join("");
  panel.classList.remove("hidden");
}

export function renderTrace(trace) {
  const panel = document.getElementById("tracePanel");
  const list = document.getElementById("traceList");

  if (!panel || !list) {
    return;
  }

  if (!trace?.stages?.length) {
    panel.classList.add("hidden");
    return;
  }

  list.innerHTML = trace.stages
    .map(
      (stage) =>
        `<li><strong>${escapeHtml(stage.label)}</strong><span>${escapeHtml(stage.detail)}</span></li>`
    )
    .join("");
  panel.classList.remove("hidden");
}

function paintCharts() {
  if (!latestPack?.analytics) {
    return;
  }

  const analytics = latestPack.analytics;
  const coverage = document.getElementById("coverageChart");
  const grounding = document.getElementById("groundingChart");
  const quiz = document.getElementById("quizChart");
  const graph = document.getElementById("graphChart");

  if (coverage) {
    coverage.innerHTML = barChartSvg(
      (analytics.coverage?.bySource || []).map((item) => ({
        label: item.source,
        value: item.used,
        percent: item.pct,
        total: item.total,
      })),
      { mode: chartState.coverageMode }
    );
  }

  if (grounding) {
    const items = [...latestPack.summary, ...latestPack.concepts, ...latestPack.quiz];
    grounding.innerHTML = histogramSvg(groundingHistogram(items, chartState.bins));
  }

  if (quiz) {
    quiz.innerHTML = donutSvg(
      (analytics.quizTypes || []).map((item) => ({
        label: labelQuizType(item.label),
        value: item.value,
      }))
    );
  }

  if (graph) {
    graph.innerHTML = conceptGraphSvg(latestPack.concepts || [], analytics.graphEdges || [], {
      minWeight: chartState.minWeight,
    });
    const highlight = term => {
      const neighbours = new Set([term]);
      graph.querySelectorAll('.chart-edge').forEach(edge => {
        const linked = !!term && (edge.dataset.from === term || edge.dataset.to === term);
        edge.classList.toggle('is-linked', linked);
        if (linked) { neighbours.add(edge.dataset.from); neighbours.add(edge.dataset.to); }
      });
      graph.classList.toggle('has-focus', !!term);
      graph.querySelectorAll('[data-term]').forEach(node => node.classList.toggle('is-linked', neighbours.has(node.dataset.term)));
    };
    graph.querySelectorAll(".chart-node").forEach((node) => {
      node.setAttribute('role', 'button');
      node.addEventListener('pointerenter', () => highlight(node.dataset.term));
      node.addEventListener('pointerleave', () => highlight(null));
      node.addEventListener('focus', () => highlight(node.dataset.term));
      node.addEventListener('blur', () => highlight(null));
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.dispatchEvent(new Event('click')); }
      });
      node.addEventListener("click", () => {
        if (node.dataset.evidenceId) {
          selectEvidence(node.dataset.evidenceId, node);
        }
      });
    });
  }
}

export function renderInsights(result) {
  const panel = document.getElementById("insightsPanel");

  if (!panel) {
    return;
  }

  if (!result.analytics) {
    panel.classList.add("hidden");
    return;
  }

  latestPack = result;
  paintCharts();

  const canvas = document.getElementById("graph3d");

  if (canvas) {
    if (!graph3d) {
      graph3d = createGraph3d(canvas, {
        onSelect: (evidenceId) => selectEvidence(evidenceId, canvas),
        onHover: (node) => {
          const readout = document.getElementById("graph3dReadout");

          if (!readout) {
            return;
          }

          readout.textContent = node
            ? node.degree
              ? `${node.term} · ${node.degree} link${node.degree === 1 ? "" : "s"} · rank ${node.rank || 0}`
              : `${node.term} · no overlapping wording with the other ideas · rank ${node.rank || 0}`
            : "Drag to rotate. Hover a node for details.";
        },
      });
    }

    graph3d?.setData(result.concepts || [], result.analytics.graphEdges || []);
  }

  panel.classList.remove("hidden");
}

export function bindInsightControls() {
  document.querySelectorAll('[data-coverage-mode], [data-bins], #graph3dSpin').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('is-active'))));
  document.querySelectorAll("[data-coverage-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      chartState.coverageMode = button.dataset.coverageMode;
      document
        .querySelectorAll("[data-coverage-mode]")
        .forEach((other) => { other.classList.toggle("is-active", other === button); other.setAttribute('aria-pressed',String(other === button)); });
      paintCharts();
    });
  });

  document.querySelectorAll("[data-bins]").forEach((button) => {
    button.addEventListener("click", () => {
      chartState.bins = Number(button.dataset.bins);
      document
        .querySelectorAll("[data-bins]")
        .forEach((other) => { other.classList.toggle("is-active", other === button); other.setAttribute('aria-pressed',String(other === button)); });
      paintCharts();
    });
  });

  document.getElementById("edgeFilter")?.addEventListener("input", (event) => {
    chartState.minWeight = Number(event.target.value) || 1;
    const readout = document.getElementById("edgeFilterValue");

    if (readout) {
      readout.textContent = `${chartState.minWeight}+`;
    }

    paintCharts();
  });

  document.getElementById("graph3dSpin")?.addEventListener("click", (event) => {
    const spinning = graph3d?.setSpinning(!graph3d.spinning);
    event.currentTarget.classList.toggle("is-active", Boolean(spinning));
    event.currentTarget.setAttribute('aria-pressed',String(Boolean(spinning)));
  });

  document.getElementById("graph3dReset")?.addEventListener("click", () => {
    graph3d?.recentre();
  });

  bindChartTooltips();
}

export function renderUnused(unused) {
  const box = document.getElementById("unusedBox");
  const list = document.getElementById("unusedList");

  if (!box || !list) {
    return;
  }

  list.innerHTML = "";

  if (!unused?.length) {
    box.classList.add("hidden");
    return;
  }

  unused.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.source}, sentence ${item.index}: ${item.sentence}`;
    list.appendChild(li);
  });

  box.classList.remove("hidden");
}

export function hideComparePanel() {
  document.getElementById("comparePanel")?.classList.add("hidden");
}

export function renderResults(result, options = {}) {
  if (!options.keepCompare) {
    hideComparePanel();
  }

  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("evidencePanel").classList.remove("hidden");
  activeTrigger = null;

  renderEvidence(result.corpus.sentenceRecords);
  renderSummary(result.summary);
  renderConcepts(result.concepts);
  renderQuiz(result.quiz);
  paginateList(document.getElementById("summaryList"), 4, "Summary");
  paginateList(document.getElementById("conceptList"), 6, "Key concepts");
  paginateList(document.getElementById("quizList"), 2, "Quiz");
  renderNextSteps(result.nextSteps);
  renderChecks(result.checks);
  renderTrace(result.trace);
  renderInsights(result);
  renderUnused(result.analytics?.coverage?.unused);
  renderWorkspace(result, selectEvidence);
  hydrateIcons();
}

export function resetResults() {
  resetWorkspace();
  document.getElementById("results").classList.add("hidden");
  document.getElementById("emptyState").classList.remove("hidden");
  document.getElementById("evidencePanel").classList.add("hidden");
  document.getElementById("evidenceList").innerHTML = "";
  document.getElementById("comparePanel")?.classList.add("hidden");
  document.getElementById("tracePanel")?.classList.add("hidden");
  document.getElementById("insightsPanel")?.classList.add("hidden");
  document.getElementById("unusedBox")?.classList.add("hidden");
  evidenceRecords = [];
  latestPack = null;
  graph3d?.setData([], []);
  setActiveStage(null);
  showError("");
  setStatus("");
  activeTrigger = null;
}

export { activeTrigger };
