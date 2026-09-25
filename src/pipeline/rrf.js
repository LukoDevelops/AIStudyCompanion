export function ranksFromScores(scores) {
  return scores
    .map((score, index) => ({ index, score }))
    .sort((left, right) => right.score - left.score)
    .map((item, position) => ({
      ...item,
      rank: position + 1,
    }));
}

export function fuseRanks(rankLists, { k = 60 } = {}) {
  const fused = new Map();

  rankLists.forEach((list) => {
    list.forEach((item) => {
      const current = fused.get(item.index) || 0;
      fused.set(item.index, current + 1 / (k + item.rank));
    });
  });

  return fused;
}

export function fusedScore(rankLists, index, { k = 60 } = {}) {
  return rankLists.reduce((total, list) => {
    const found = list.find((item) => item.index === index);
    return found ? total + 1 / (k + found.rank) : total;
  }, 0);
}
