import { contentTokens } from "./text.js";

export function tokenOverlapStats(claimText, evidenceTokens) {
  const claimTokens = contentTokens(claimText);
  const evidence = evidenceTokens || [];

  if (!claimTokens.length || !evidence.length) {
    return { recall: 0, precision: 0, f1: 0 };
  }

  const claimSet = new Set(claimTokens);
  const evidenceSet = new Set(evidence);
  let intersection = 0;
  claimSet.forEach((token) => {
    if (evidenceSet.has(token)) {
      intersection += 1;
    }
  });

  const recall = intersection / claimSet.size;
  const precision = intersection / evidenceSet.size;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return { recall, precision, f1 };
}

export function tokenOverlap(claimText, evidenceTokens) {
  return tokenOverlapStats(claimText, evidenceTokens).recall;
}

export function scoreGrounding(claimText, record, provider, recordIndex) {
  const stats = tokenOverlapStats(claimText, record?.tokens || []);
  const retrieval =
    provider && typeof recordIndex === "number"
      ? Math.max(0, provider.relevanceToQuery?.(recordIndex, contentTokens(claimText)) ??
          provider.score(recordIndex, contentTokens(claimText)))
      : 0;
  const groundingScore =
    stats.recall >= 0.999
      ? 100
      : Math.min(100, Math.round((stats.f1 * 0.7 + Math.min(1, retrieval) * 0.3) * 100));

  return {
    overlapScore: Number((stats.recall * 100).toFixed(1)),
    precisionScore: Number((stats.precision * 100).toFixed(1)),
    recallScore: Number((stats.recall * 100).toFixed(1)),
    f1Score: Number((stats.f1 * 100).toFixed(1)),
    retrievalScore: Number((retrieval * 100).toFixed(1)),
    groundingScore,
  };
}

export function attachGrounding(items, corpus, provider, claimText) {
  const lookup = new Map(
    corpus.sentenceRecords.map((record, index) => [record.id, { record, index }])
  );

  return items.map((item) => {
    const found = lookup.get(item.evidenceId);

    if (!found) {
      return {
        ...item,
        overlapScore: 0,
        precisionScore: 0,
        recallScore: 0,
        f1Score: 0,
        retrievalScore: 0,
        groundingScore: 0,
      };
    }

    return {
      ...item,
      ...scoreGrounding(claimText(item), found.record, provider, found.index),
    };
  });
}

export function meanGrounding(items) {
  if (!items.length) {
    return 0;
  }

  return Math.round(
    items.reduce((total, item) => total + (item.groundingScore || 0), 0) / items.length
  );
}
