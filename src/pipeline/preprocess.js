import { splitDocumentSentences } from "./document.js";
import { contentTokens, splitSentences } from "./text.js";

const DEFAULT_MAX_SENTENCES = 1400;

function blocksFor(source) {
  if (Array.isArray(source.blocks) && source.blocks.length) {
    return source.blocks;
  }

  return splitSentences(source.text).map((sentence) => ({
    kind: "text",
    text: sentence,
    heading: null,
    page: 1,
  }));
}

/**
 * Bullets and headings are short by design, so the minimum sentence length is
 * relaxed for them instead of throwing the content away.
 */
function sentencesFor(block) {
  if (block.kind === "bullet") {
    return [block.text];
  }

  return splitDocumentSentences(block.text, { minLength: 18 });
}

export function preprocessSources(sources, options = {}) {
  const { maxSentences = DEFAULT_MAX_SENTENCES } = options;
  const pools = [];
  const sections = [];
  const sectionLookup = new Map();

  for (const source of sources) {
    const sentenceRecords = [];
    pools.push(sentenceRecords);
    const blocks = blocksFor(source);
    const bodyBlocks = blocks.filter((block) => block.kind !== "heading");
    const usable = bodyBlocks.length ? bodyBlocks : blocks;
    let index = 0;

    for (const block of usable) {
      for (const sentence of sentencesFor(block)) {
        const tokens = contentTokens(sentence);

        if (!tokens.length) {
          continue;
        }

        index += 1;
        const heading = block.heading || null;
        const sectionKey = `${source.label}::${heading || "Body"}`;
        let section = sectionLookup.get(sectionKey);

        if (!section) {
          section = {
            key: sectionKey,
            source: source.label,
            heading: heading || "Body",
            sentenceIds: [],
          };
          sections.push(section);
          sectionLookup.set(sectionKey, section);
        }

        const record = {
          id: `${source.label}-${index}`,
          source: source.label,
          origin: block.origin || source.origin || "paste",
          adapter: source.adapter || "text",
          index,
          sentence,
          tokens,
          heading,
          section: section.key,
          kind: block.kind || "text",
          page: block.page || 1,
        };

        section.sentenceIds.push(record.id);
        sentenceRecords.push(record);
      }
    }
  }

  // Share the budget before sampling: early PDFs cannot crowd out later media.
  const quotas = pools.map(() => 0);
  let remaining = Math.max(0, Math.floor(maxSentences));
  while (remaining > 0) {
    let added = false;
    pools.forEach((pool, i) => {
      if (remaining > 0 && quotas[i] < pool.length) { quotas[i]++; remaining--; added = true; }
    });
    if (!added) break;
  }
  // Spread retained passages through long sources, rather than cutting off conclusions.
  const sampled = pools.map((pool, i) => Array.from({length:quotas[i]}, (_, j) =>
    pool[quotas[i] === 1 ? 0 : Math.round(j * (pool.length - 1) / (quotas[i] - 1))]));
  const sentenceRecords = [];
  for (let i = 0; i < Math.max(0, ...quotas); i++) {
    sampled.forEach(pool => { if (pool[i]) sentenceRecords.push(pool[i]); });
  }
  const retained = new Set(sentenceRecords.map(record => record.id));
  sections.forEach(section => { section.sentenceIds = section.sentenceIds.filter(id => retained.has(id)); });
  const truncated = pools.reduce((sum, pool) => sum + pool.length, 0) > sentenceRecords.length;

  return {
    sources,
    sentenceRecords,
    sections: sections.filter(section => section.sentenceIds.length),
    truncated,
  };
}
