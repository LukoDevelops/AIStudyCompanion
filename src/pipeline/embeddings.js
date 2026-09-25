import { createHybridProvider } from "./hybrid.js";
import {
  buildTfidfVectors,
  cosineDense,
  cosineSparse,
  queryVectorFromTerms,
} from "./retrieval.js";

let miniLmPipeline = null;
let miniLmFailed = false;

function relevanceFromAnchors(records, similarFn, index, queryTerms) {
  const anchors = records
    .map((record, recordIndex) => ({ record, recordIndex }))
    .filter(({ record }) =>
      queryTerms.some(
        (term) =>
          record.tokens.includes(term) || record.sentence.toLowerCase().includes(term)
      )
    );

  if (!anchors.length) {
    return similarFn(index, 0);
  }

  return (
    anchors.reduce((total, anchor) => total + similarFn(index, anchor.recordIndex), 0) /
    anchors.length
  );
}

export function lexicalEmbeddingProvider(records) {
  const vectors = buildTfidfVectors(records);

  const score = (index, queryTerms) => {
    const query = queryVectorFromTerms(queryTerms, vectors);
    return cosineSparse(vectors[index] || new Map(), query);
  };

  const similar = (leftIndex, rightIndex) =>
    cosineSparse(vectors[leftIndex] || new Map(), vectors[rightIndex] || new Map());

  return {
    name: "tfidf",
    ready: true,
    score,
    similar,
    relevanceToQuery(index, queryTerms) {
      return relevanceFromAnchors(records, similar, index, queryTerms);
    },
  };
}

export async function loadMiniLmProvider(records, onStatus = () => {}) {
  if (miniLmFailed) {
    throw new Error("The semantic model could not load earlier in this session.");
  }

  onStatus("Loading the local MiniLM model. It downloads about 23MB once, then stays on this computer.");

  if (!miniLmPipeline) {
    const { pipeline } = await import("@huggingface/transformers");
    // Set the WASM dtype explicitly to avoid a fallback warning.
    miniLmPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      device: "wasm",
      dtype: "q8",
    });
  }

  const vectors = [];

  for (const record of records) {
    const output = await miniLmPipeline(record.sentence, {
      pooling: "mean",
      normalize: true,
    });
    vectors.push(Array.from(output.data));
  }

  const similar = (leftIndex, rightIndex) =>
    cosineDense(vectors[leftIndex] || [], vectors[rightIndex] || []);
  const fallback = lexicalEmbeddingProvider(records);

  return {
    name: "minilm",
    ready: true,
    score(index, queryTerms) {
      return fallback.score(index, queryTerms);
    },
    similar,
    relevanceToQuery(index, queryTerms) {
      return relevanceFromAnchors(records, similar, index, queryTerms);
    },
    async querySimilarity(index, queryText) {
      const output = await miniLmPipeline(queryText, {
        pooling: "mean",
        normalize: true,
      });
      return cosineDense(vectors[index] || [], Array.from(output.data));
    },
  };
}

export async function createEmbeddingProvider(records, { semantic = false, onStatus = () => {} } = {}) {
  if (semantic) {
    try {
      const miniLm = await loadMiniLmProvider(records, onStatus);
      return createHybridProvider(records, miniLm);
    } catch (error) {
      miniLmFailed = true;
      onStatus(`The semantic model is unavailable (${error.message}). Falling back to local TF-IDF + BM25 search.`);
      return createHybridProvider(records, lexicalEmbeddingProvider(records));
    }
  }

  return createHybridProvider(records, lexicalEmbeddingProvider(records));
}

export function applyEmbeddingBoost(scoredRecords, provider, queryTerms) {
  if (!provider) {
    return scoredRecords;
  }

  return scoredRecords.map((item, index) => ({
    ...item,
    score: item.score + provider.score(index, queryTerms) * 2,
  }));
}
