export function buildBm25Index(records, { k1 = 1.5, b = 0.75 } = {}) {
  const documents = records.map((record) => record.tokens || []);
  const documentCount = documents.length || 1;
  const documentFrequency = new Map();
  const lengths = documents.map((tokens) => tokens.length);
  const averageLength =
    lengths.reduce((total, length) => total + length, 0) / documentCount;

  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }

  function idf(token) {
    const df = documentFrequency.get(token) || 0;
    return Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));
  }

  function score(index, queryTerms) {
    const tokens = documents[index] || [];
    if (!tokens.length || !queryTerms?.length) {
      return 0;
    }

    const tf = new Map();
    tokens.forEach((token) => tf.set(token, (tf.get(token) || 0) + 1));
    const lengthNorm = 1 - b + b * ((lengths[index] || 0) / (averageLength || 1));

    return queryTerms.reduce((total, term) => {
      const frequency = tf.get(term) || 0;
      if (!frequency) {
        return total;
      }

      const numerator = frequency * (k1 + 1);
      const denominator = frequency + k1 * lengthNorm;
      return total + idf(term) * (numerator / denominator);
    }, 0);
  }

  function rank(queryTerms) {
    return records
      .map((record, index) => ({ index, record, score: score(index, queryTerms) }))
      .sort((left, right) => right.score - left.score);
  }

  return {
    name: "bm25",
    score,
    rank,
    idf,
    averageLength,
    documentCount,
  };
}
