export function buildCoverage(corpus, items = []) {
  const validIds = new Set(corpus.sentenceRecords.map(record => record.id));
  const used = new Set(items.map((item) => item.evidenceId).filter(id => validIds.has(id)));
  const bySource = new Map();

  corpus.sentenceRecords.forEach((record) => {
    const bucket = bySource.get(record.source) || {
      source: record.source,
      total: 0,
      used: 0,
    };
    bucket.total += 1;
    if (used.has(record.id)) {
      bucket.used += 1;
    }
    bySource.set(record.source, bucket);
  });

  const unused = corpus.sentenceRecords
    .filter((record) => !used.has(record.id))
    .map((record) => ({
      id: record.id,
      source: record.source,
      index: record.index,
      sentence: record.sentence,
    }));

  const sentenceCount = corpus.sentenceRecords.length;

  return {
    usedCount: used.size,
    unusedCount: unused.length,
    sentenceCount,
    coveragePct: sentenceCount ? Math.round((used.size / sentenceCount) * 100) : 0,
    bySource: [...bySource.values()].map((bucket) => ({
      ...bucket,
      pct: bucket.total ? Math.round((bucket.used / bucket.total) * 100) : 0,
    })),
    unused,
  };
}

export function groundingHistogram(items, bins = 5) {
  const counts = Array.from({ length: bins }, () => 0);

  items.forEach((item) => {
    const score = Math.max(0, Math.min(100, item.groundingScore || 0));
    const index = Math.min(bins - 1, Math.floor(score / (100 / bins)));
    counts[index] += 1;
  });

  const width = 100 / bins;
  return counts.map((count, index) => ({
    label: `${Math.round(index * width)}–${Math.round((index + 1) * width)}`,
    value: count,
  }));
}

export function quizTypeMix(quiz) {
  const counts = new Map();
  quiz.forEach((item) => {
    counts.set(item.type, (counts.get(item.type) || 0) + 1);
  });

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}
