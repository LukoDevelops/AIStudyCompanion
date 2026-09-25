import { modalitySummary } from './studyPlan.js';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function toneFor(value, { clear = 80, watch = 55 } = {}) {
  return value >= clear ? 'clear' : value >= watch ? 'watch' : 'attention';
}

function percent(value) {
  return `${Math.round(clamp(value))}%`;
}

/**
 * Builds a compact, explainable health report for the generated study pack.
 * It measures traceability and study readiness, not factual correctness.
 */
export function buildStudyAudit(pack, { practice = {}, cardsReviewed = 0 } = {}) {
  const coverage = clamp(pack?.analytics?.coverage?.coveragePct ?? pack?.checks?.coveragePct ?? 0);
  const links = clamp(pack?.checks?.integrity?.linkCoverage ?? pack?.checks?.groundingCoverage ?? 0);
  const representation = clamp(pack?.checks?.integrity?.sourceRepresentationPct ?? 0);
  const sentenceCount = Number(pack?.corpus?.sentenceRecords?.length || 0);
  const sourceCount = Number(pack?.sourceCount || pack?.corpus?.sources?.length || 0);
  const issueCount = Number(pack?.checks?.integrity?.issues?.length || 0);
  const warningCount = Number(pack?.checks?.adapterWarnings?.length || 0);
  const practiceTotal = Number(practice.total || pack?.quiz?.length || 0);
  const practiceAttempted = Number(practice.attempted || 0);
  const practiceRate = practiceTotal ? (practiceAttempted / practiceTotal) * 100 : 0;
  const modalities = modalitySummary(pack);
  const activeLanes = ['text', 'audio', 'image'].filter((key) => modalities[key] > 0).length;
  const reviewRate = pack?.concepts?.length
    ? Math.min(100, (Number(cardsReviewed) / Math.max(1, pack.concepts.length)) * 100)
    : 0;

  const checks = [
    {
      id: 'coverage',
      label: 'Source coverage',
      value: percent(coverage),
      tone: toneFor(coverage),
      detail: `${pack?.analytics?.coverage?.usedCount || 0} of ${sentenceCount} kept source sentences appear in the pack.`,
      view: 'sources',
    },
    {
      id: 'links',
      label: 'Evidence links',
      value: percent(links),
      tone: toneFor(links),
      detail: 'Outputs with a valid source passage behind them.',
      view: 'sources',
    },
    {
      id: 'input-lanes',
      label: 'Input lanes',
      value: `${activeLanes}/3`,
      tone: activeLanes ? 'clear' : 'attention',
      detail: activeLanes ? `${activeLanes} input type${activeLanes === 1 ? '' : 's'} contributed material.` : 'No labelled input type made it into the pack.',
      view: 'inputs',
    },
    {
      id: 'recall',
      label: 'Recall loop',
      value: practiceTotal ? `${practiceAttempted}/${practiceTotal}` : `${Math.round(reviewRate)}%`,
      tone: practiceTotal ? toneFor(practiceRate, { clear: 80, watch: 1 }) : (reviewRate ? 'watch' : 'attention'),
      detail: practiceTotal ? 'Questions attempted in your current practice record.' : 'Review a flashcard or start a question round to begin tracking recall.',
      view: 'practice',
    },
    {
      id: 'integrity',
      label: 'Structural audit',
      value: issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'Clear',
      tone: issueCount ? 'attention' : warningCount ? 'watch' : 'clear',
      detail: issueCount ? 'Some source links or generated fields need a human check.' : warningCount ? `${warningCount} import warning${warningCount === 1 ? '' : 's'} were kept for review.` : 'Source links and required output fields passed the structural checks.',
      view: issueCount || warningCount ? 'sources' : 'overview',
    },
  ];

  const score = Math.round(clamp(
    coverage * 0.25 +
      links * 0.25 +
      representation * 0.15 +
      (activeLanes ? 100 : 0) * 0.1 +
      Math.max(practiceRate, reviewRate) * 0.15 +
      (issueCount ? 0 : 100) * 0.1 -
      Math.min(20, warningCount * 4),
  ));
  const tone = score >= 80 ? 'clear' : score >= 55 ? 'watch' : 'attention';
  const label = tone === 'clear' ? 'Traceable' : tone === 'watch' ? 'Reviewable' : 'Check first';
  const summary = tone === 'clear'
    ? `The pack has a strong source trail across ${sourceCount} source${sourceCount === 1 ? '' : 's'}. Use Practice to see what you remember.`
    : tone === 'watch'
      ? 'The pack is usable, but a few places are worth checking before you rely on it.'
      : 'Start with the source view and resolve the visible gaps before treating the generated material as study material.';

  return { score, tone, label, summary, checks };
}
