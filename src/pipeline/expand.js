export function expandQuery(terms, records, limit = 3) {
  if (!terms?.length || !records?.length) {
    return [];
  }

  const scores = new Map();

  records.forEach((record) => {
    const unique = new Set(record.tokens || []);
    const hits = terms.filter((term) => unique.has(term)).length;
    if (!hits) {
      return;
    }

    unique.forEach((token) => {
      if (terms.includes(token) || token.length < 4) {
        return;
      }

      scores.set(token, (scores.get(token) || 0) + hits);
    });
  });

  return [...scores.entries()]
    .filter(([, score]) => score >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([term]) => term);
}
