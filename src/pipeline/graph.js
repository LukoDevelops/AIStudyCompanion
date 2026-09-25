function sharedTokens(left, right) {
  const rightSet = new Set(right.toLowerCase().split(/\s+/));
  return left
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 && rightSet.has(token)).length;
}

function documentLabel(concept) {
  return String(concept.source || "").replace(/,\s*sentence\s+\d+\s*$/i, "").trim();
}

export function buildConceptEdges(concepts) {
  const edges = [];

  concepts.forEach((concept, index) => {
    concepts.slice(index + 1).forEach((other) => {
      const shared = sharedTokens(concept.term, other.term);
      const sameSentence = concept.evidenceId && concept.evidenceId === other.evidenceId ? 3 : 0;
      const sameSection =
        concept.section && concept.section === other.section ? 1 : 0;
      const leftDoc = documentLabel(concept);
      const rightDoc = documentLabel(other);
      const sameSource = leftDoc && leftDoc === rightDoc ? 1 : 0;
      const weight = shared + sameSentence + sameSection + sameSource;

      if (weight > 0) {
        edges.push({
          from: concept.term,
          to: other.term,
          weight,
        });
      }
    });
  });

  return edges;
}

export function pageRankScores(nodes, edges, { damping = 0.85, iterations = 24 } = {}) {
  const size = nodes.length;
  const scores = {};

  if (!size) {
    return scores;
  }

  const index = new Map(nodes.map((node, position) => [node, position]));
  let rank = Array.from({ length: size }, () => 1 / size);
  const outbound = Array.from({ length: size }, () => 0);
  const incoming = Array.from({ length: size }, () => []);

  edges.forEach((edge) => {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (from == null || to == null) {
      return;
    }

    const weight = edge.weight || 1;
    outbound[from] += weight;
    outbound[to] += weight;
    incoming[to].push({ from, weight });
    incoming[from].push({ from: to, weight });
  });

  for (let step = 0; step < iterations; step += 1) {
    const next = Array.from({ length: size }, () => (1 - damping) / size);
    for (let node = 0; node < size; node += 1) {
      incoming[node].forEach(({ from, weight }) => {
        next[node] += damping * rank[from] * (weight / (outbound[from] || 1));
      });
    }
    rank = next;
  }

  nodes.forEach((node, position) => {
    scores[node] = Number(rank[position].toFixed(4));
  });

  return scores;
}

export function attachRelatedConcepts(concepts) {
  const edges = buildConceptEdges(concepts);
  const ranks = pageRankScores(
    concepts.map((concept) => concept.term),
    edges
  );

  return concepts.map((concept) => {
    const related = edges
      .filter((edge) => edge.from === concept.term || edge.to === concept.term)
      .map((edge) => ({
        term: edge.from === concept.term ? edge.to : edge.from,
        score: edge.weight,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((item) => item.term);

    return {
      ...concept,
      related,
      pageRank: ranks[concept.term] || 0,
      graphEdges: edges.filter(
        (edge) => edge.from === concept.term || edge.to === concept.term
      ),
    };
  });
}

export function meanPageRank(concepts) {
  if (!concepts.length) {
    return 0;
  }

  return Number(
    (
      concepts.reduce((total, item) => total + (item.pageRank || 0), 0) /
      concepts.length
    ).toFixed(4)
  );
}
