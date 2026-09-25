export function buildTfidfVectors(records) {
  const documentFrequency = new Map();
  const documents = records.map((record) => record.tokens);
  const documentCount = documents.length || 1;

  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }

  return documents.map((tokens) => {
    const termFrequency = new Map();
    tokens.forEach((token) => {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    });

    const vector = new Map();
    const length = tokens.length || 1;

    for (const [token, count] of termFrequency) {
      const idf = Math.log(
        (documentCount + 1) / ((documentFrequency.get(token) || 0) + 1)
      );
      vector.set(token, (count / length) * idf);
    }

    return vector;
  });
}

export function cosineSparse(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const [key, value] of left) {
    leftNorm += value * value;
    if (right.has(key)) {
      dot += value * right.get(key);
    }
  }

  for (const value of right.values()) {
    rightNorm += value * value;
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function cosineDense(left, right) {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let i = 0; i < size; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function queryVectorFromTerms(terms, documentVectors) {
  const query = new Map();

  for (const term of terms) {
    query.set(term, (query.get(term) || 0) + 1);
  }

  if (!query.size && documentVectors[0]) {
    return documentVectors[0];
  }

  return query;
}

export function rankRecords(records, vectors, queryVector, scoreFn) {
  return records
    .map((record, index) => ({
      record,
      index,
      score: scoreFn(vectors[index], queryVector),
    }))
    .sort((left, right) => right.score - left.score);
}
