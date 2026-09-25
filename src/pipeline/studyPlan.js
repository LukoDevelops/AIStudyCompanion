const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function coverageFor(pack) {
  return clamp(
    pack?.analytics?.coverage?.coveragePct ??
      pack?.checks?.coveragePct ??
      pack?.checks?.integrity?.sourceRepresentationPct ??
      0,
  );
}

function linkCoverageFor(pack) {
  return clamp(pack?.checks?.integrity?.linkCoverage ?? pack?.checks?.groundingCoverage ?? 0);
}

function sourceRepresentationFor(pack) {
  return clamp(pack?.checks?.integrity?.sourceRepresentationPct ?? 0);
}

export function modalitySummary(pack) {
  const sources = pack?.corpus?.sources || [];
  const counts = { text: 0, audio: 0, image: 0, other: 0 };

  sources.forEach((source) => {
    const origin = String(source?.origin || '').toLowerCase();
    if (origin.includes('vision') || origin === 'ocr' || origin === 'image') counts.image += 1;
    else if (origin.includes('audio') || origin === 'whisper' || origin === 'transcript') counts.audio += 1;
    else if (origin) counts.text += 1;
    else counts.other += 1;
  });

  return { ...counts, total: sources.length };
}

export function studyReadiness(pack, { practice = {}, cardsReviewed = 0 } = {}) {
  const coverage = coverageFor(pack);
  const linkCoverage = linkCoverageFor(pack);
  const sourceRepresentation = sourceRepresentationFor(pack);
  const modalities = modalitySummary(pack);
  const modalityScore = modalities.total ? Math.min(100, modalities.total * 34) : 0;
  const quizScore = pack?.quiz?.length ? Math.min(100, pack.quiz.length * 20) : 0;
  const practiceScore = practice.total ? clamp((practice.attempted / practice.total) * 100) : 0;
  const reviewScore = cardsReviewed ? Math.min(100, cardsReviewed / Math.max(1, pack?.concepts?.length || cardsReviewed) * 100) : 0;
  const structuralPenalty = Math.min(20, (pack?.checks?.integrity?.issues?.length || 0) * 4);
  const score = Math.round(clamp(
    coverage * 0.25 +
      linkCoverage * 0.25 +
      sourceRepresentation * 0.15 +
      modalityScore * 0.1 +
      quizScore * 0.1 +
      Math.max(practiceScore, reviewScore) * 0.15 -
      structuralPenalty,
  ));

  const label = score >= 80 ? 'Ready to review' : score >= 55 ? 'A focused pass will help' : 'Needs a source check';
  const explanation = score >= 80
    ? 'Your pack has broad source coverage and enough practice material for a focused study round.'
    : score >= 55
      ? 'The pack is usable, but the checks suggest a few sources or practice items deserve attention.'
      : 'Start with the evidence view and resolve the gaps before relying on the generated pack.';

  return {
    score,
    label,
    explanation,
    metrics: [
      { label: 'Source coverage', value: coverage, suffix: '%' },
      { label: 'Linked outputs', value: linkCoverage, suffix: '%' },
      { label: 'Sources represented', value: sourceRepresentation, suffix: '%' },
      { label: 'Practice started', value: Math.round(practiceScore), suffix: '%' },
    ],
    modalities,
  };
}

export function buildStudyPlan(pack, { practice = {}, cardsReviewed = 0 } = {}) {
  const coverage = coverageFor(pack);
  const structuralIssues = pack?.checks?.integrity?.issues?.length || 0;
  const missed = practice.missed || 0;

  return [
    {
      id: 'orient', number: '01', label: 'Orient', title: 'Read the signal first',
      detail: `${pack?.summary?.length || 0} summary points and ${pack?.concepts?.length || 0} concepts are ready to scan.`,
      view: 'read', state: practice.attempted ? 'complete' : 'next',
    },
    {
      id: 'recall', number: '02', label: 'Recall', title: 'Test without looking',
      detail: practice.attempted
        ? `${practice.firstCorrect || 0} first-attempt answer(s) are currently correct.`
        : `${pack?.quiz?.length || 0} source-linked question(s) are waiting.`,
      view: 'practice', state: practice.attempted ? (practice.missed ? 'attention' : 'complete') : 'next',
    },
    {
      id: 'verify', number: '03', label: 'Verify', title: 'Inspect the evidence',
      detail: structuralIssues
        ? `${structuralIssues} structural issue(s) are flagged for human review.`
        : `${coverage}% of retained source sentences are represented in the pack.`,
      view: 'sources', state: structuralIssues || coverage < 60 ? 'attention' : 'ready',
    },
    {
      id: 'connect', number: '04', label: 'Connect', title: 'Explore the structure',
      detail: cardsReviewed
        ? `${cardsReviewed} flashcard(s) reviewed; use the graph to connect the ideas behind them.`
        : 'Use the concept graph to see which ideas share wording or context.',
      view: 'explore', state: 'ready',
    },
    {
      id: 'reinforce', number: '05', label: 'Reinforce', title: missed ? 'Retry the missed questions' : 'Build a second pass',
      detail: missed
        ? `${missed} question(s) need another look in the current practice round.`
        : 'Generate a follow-up set when you want fresh questions from unused passages.',
      view: 'practice', state: missed ? 'attention' : 'ready',
    },
  ];
}

export { coverageFor, linkCoverageFor, sourceRepresentationFor };
