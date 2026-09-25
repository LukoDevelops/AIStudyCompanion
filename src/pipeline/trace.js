export function buildTrace({ sources, corpus, provider, engine, keywords, coverage }) {
  const retrieval = provider?.name || "baseline-keywords";

  return {
    adapters: sources.map((source) => ({
      label: source.label,
      adapter: source.adapter,
      origin: source.origin,
      visionStages: source.visionStages || [],
      ocrQuality: source.ocrQuality || null,
    })),
    sentenceCount: corpus.sentenceRecords.length,
    keywordCount: keywords?.length || 0,
    retrieval,
    engine,
    coveragePct: coverage?.coveragePct || 0,
    stages: [
      {
        id: "adapters",
        label: "Adapters",
        detail: `${sources.length} input${sources.length === 1 ? "" : "s"}`,
      },
      {
        id: "store",
        label: "Sentence store",
        detail: `${corpus.sentenceRecords.length} sentences`,
      },
      {
        id: "retrieve",
        label: "Hybrid retrieval",
        detail: retrieval,
      },
      {
        id: "generate",
        label: "Pack generation",
        detail: engine === "cloud" ? "Study Reasoner · cloud generation + citation checks" : engine === "semantic" ? "Semantic Explorer" : engine === "baseline" ? "Keyword Scout" : "Hybrid Focus",
      },
      {
        id: "ground",
        label: "Grounding",
        detail: `${coverage?.coveragePct || 0}% of sentences cited`,
      },
    ],
  };
}
