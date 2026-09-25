export function selectMmr(candidates, { limit, lambda = 0.72, similarity, initial = [] }) {
  const selected = [];
  const remaining = candidates.map(candidate => ({
    candidate,
    redundancy: initial.reduce((max, item) => Math.max(max, similarity(candidate, item)), 0),
  }));

  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    remaining.forEach(({candidate, redundancy}, index) => {
      const score = lambda * candidate.relevance - (1 - lambda) * redundancy;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const chosen = remaining.splice(bestIndex, 1)[0].candidate;
    selected.push(chosen);
    // Incremental maximum: each pair is evaluated once, not once per later round.
    if (selected.length < limit) for (const entry of remaining) {
      entry.redundancy = Math.max(entry.redundancy, similarity(entry.candidate, chosen));
    }
  }

  return selected;
}
