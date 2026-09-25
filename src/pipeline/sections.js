const SENTENCES_PER_POINT = 34;

export function summaryLimitFor(sentenceCount) {
  if (sentenceCount <= 12) {
    return Math.max(2, Math.min(4, sentenceCount));
  }

  return Math.max(4, Math.min(14, Math.ceil(sentenceCount / SENTENCES_PER_POINT) + 3));
}

export function conceptLimitFor(sentenceCount) {
  if (sentenceCount <= 12) {
    return 6;
  }

  return Math.max(8, Math.min(16, Math.ceil(sentenceCount / 40) + 7));
}

/**
 * Give each section one point, then share the rest by section size.
 */
export function allocateBudgets(sections, totalBudget) {
  const usable = sections.filter((section) => section.sentenceIds.length > 0);
  const budgets = new Map();

  if (!usable.length || totalBudget <= 0) {
    return budgets;
  }

  if (usable.length >= totalBudget) {
    usable
      .slice()
      .sort((left, right) => right.sentenceIds.length - left.sentenceIds.length)
      .slice(0, totalBudget)
      .forEach((section) => budgets.set(section.key, 1));

    return budgets;
  }

  const totalSentences = usable.reduce(
    (total, section) => total + section.sentenceIds.length,
    0
  );

  // Cap each share at the number of available sentences.
  const shares = usable.map((section) => {
    const cap = section.sentenceIds.length;
    // Reserve one per section first, then apportion only the remaining budget.
    const available = Math.max(0, totalSentences - usable.length);
    const exact = available ? ((cap - 1) / available) * (totalBudget - usable.length) : 0;
    const floor = Math.min(cap, 1 + Math.floor(exact));
    return { section, cap, floor, remainder: exact - Math.floor(exact) };
  });

  shares.forEach(({ section, floor }) => budgets.set(section.key, floor));

  let spare = totalBudget - shares.reduce((total, share) => total + share.floor, 0);
  const ordered = [...shares].sort((left, right) => right.remainder - left.remainder);

  while (spare > 0) {
    const before = spare;

    for (const { section, cap } of ordered) {
      if (spare <= 0) {
        break;
      }

      const current = budgets.get(section.key) || 0;

      if (current < cap) {
        budgets.set(section.key, current + 1);
        spare -= 1;
      }
    }

    if (spare === before) {
      break;
    }
  }

  return budgets;
}

export function shouldUseSections(corpus) {
  return (
    Array.isArray(corpus.sections) &&
    corpus.sections.length > 1 &&
    corpus.sentenceRecords.length > 24
  );
}

export function groupRecordsBySection(corpus) {
  const groups = new Map();

  corpus.sentenceRecords.forEach((record, originalIndex) => {
    const key = record.section || `${record.source}::Body`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push({ record, originalIndex });
  });

  return groups;
}
