import { buildBm25Index } from "./bm25.js";
import { fuseRanks, ranksFromScores } from "./rrf.js";

const CANDIDATE_LIMIT = 72;
const ANCHOR_LIMIT = 12;

function normaliseScores(values) {
  const max = Math.max(0, ...values);
  return values.map((value) => (max ? value / max : 0));
}

/**
 * Rank all sentences with BM25 and TF-IDF. Limit embedding comparisons to
 * the top candidates and a small anchor set to bound the pairwise work.
 */
export function createHybridProvider(records, baseProvider) {
  const bm25 = buildBm25Index(records);
  const cache = new Map();

  function computeScores(queryTerms) {
    const terms = queryTerms || [];
    const bm25Raw = records.map((_, index) => bm25.score(index, terms));
    const lexicalRaw = records.map((_, index) => baseProvider.score?.(index, terms) ?? 0);
    const bm25Norm = normaliseScores(bm25Raw);
    const lexicalNorm = normaliseScores(lexicalRaw);

    const combined = records.map((_, index) => ({
      index,
      score: bm25Norm[index] + lexicalNorm[index],
    }));
    const candidates = combined
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.min(CANDIDATE_LIMIT, records.length))
      .map((item) => item.index);

    const lists = [ranksFromScores(lexicalNorm), ranksFromScores(bm25Norm)];

    if (typeof baseProvider.similar === "function") {
      const anchors = combined
        .filter((item) => bm25Raw[item.index] > 0)
        .slice(0, ANCHOR_LIMIT)
        .map((item) => item.index);
      const anchorSet = anchors.length ? anchors : candidates.slice(0, 1);
      const semanticRaw = records.map(() => 0);

      candidates.forEach((index) => {
        const total = anchorSet.reduce(
          (sum, anchor) => sum + baseProvider.similar(index, anchor),
          0
        );
        semanticRaw[index] = anchorSet.length ? total / anchorSet.length : 0;
      });

      lists.push(ranksFromScores(normaliseScores(semanticRaw)));
    }

    const fused = fuseRanks(lists);
    const candidateSet = new Set(candidates);
    const fusedScores = records.map((_, index) =>
      candidateSet.has(index) ? fused.get(index) || 0 : 0
    );

    return normaliseScores(fusedScores);
  }

  function scoresFor(queryTerms) {
    const key = (queryTerms || []).join("|");

    if (!cache.has(key)) {
      if (cache.size > 64) {
        cache.clear();
      }

      cache.set(key, computeScores(queryTerms));
    }

    return cache.get(key);
  }

  const semantic = String(baseProvider.name || "").includes("minilm");

  return {
    name: semantic ? "hybrid-minilm-bm25" : "hybrid-tfidf-bm25",
    ready: true,
    inner: baseProvider,
    bm25,
    score(index, queryTerms) {
      return scoresFor(queryTerms)[index] || 0;
    },
    similar(leftIndex, rightIndex) {
      return baseProvider.similar(leftIndex, rightIndex);
    },
    relevanceToQuery(index, queryTerms) {
      return scoresFor(queryTerms)[index] || 0;
    },
    rankQuery(queryTerms) {
      return scoresFor(queryTerms)
        .map((score, index) => ({ index, score, record: records[index] }))
        .sort((left, right) => right.score - left.score);
    },
  };
}
