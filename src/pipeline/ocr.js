const SYMBOL_JUNK = /^[^A-Za-z0-9]+$/;
const ALLOWED_SINGLE = new Set(["a", "i", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const DECORATIVE = /[\u00a9\u00ae\u2122\u00ab\u00bb\u2039\u203a\u25c4\u25ba\u2666\u2665\u2660\u2663\u00a4\u00b6\u2020\u2021]/g;

/**
 * OCR emits low-confidence guesses alongside real text. A token is only kept if
 * it looks like a word or a number rather than decorative noise.
 */
export function isJunkToken(text) {
  const value = String(text || "").trim();

  if (!value || SYMBOL_JUNK.test(value)) {
    return true;
  }

  const lower = value.toLowerCase();

  if (value.length === 1 && !ALLOWED_SINGLE.has(lower)) {
    return true;
  }

  const letters = (value.match(/[A-Za-z]/g) || []).length;
  const digits = (value.match(/[0-9]/g) || []).length;
  const other = value.length - letters - digits;

  if (other / value.length > 0.4) {
    return true;
  }

  if (letters >= 4 && !/[aeiouy]/i.test(value)) {
    return true;
  }

  return false;
}

/** Collapses immediately repeated words or phrases such as "Pros Pros". */
export function collapseRepeats(line) {
  const words = String(line || "").split(/\s+/).filter(Boolean);
  const output = [];

  for (let index = 0; index < words.length; index += 1) {
    let collapsed = false;

    for (let size = Math.min(4, output.length); size >= 1; size -= 1) {
      const tail = output.slice(output.length - size);
      const next = words.slice(index, index + size);

      if (
        next.length === size &&
        tail.every((word, position) => word.toLowerCase() === next[position].toLowerCase())
      ) {
        index += size - 1;
        collapsed = true;
        break;
      }
    }

    if (!collapsed) {
      output.push(words[index]);
    }
  }

  return output.join(" ");
}

function bboxOf(node) {
  const box = node?.bbox || {};
  return {
    x0: Number(box.x0 || 0),
    y0: Number(box.y0 || 0),
    x1: Number(box.x1 || 0),
    y1: Number(box.y1 || 0),
  };
}

/**
 * Multi-column layouts break naive top-to-bottom reading. Regions are bucketed
 * into columns by horizontal position, then read down each column in turn.
 */
export function orderRegions(regions, { pageWidth = 0 } = {}) {
  if (regions.length < 2) {
    return regions;
  }

  const width =
    pageWidth || Math.max(...regions.map((region) => bboxOf(region).x1), 1);
  const columnWidth = Math.max(width / 3, 1);

  return [...regions].sort((left, right) => {
    const leftBox = bboxOf(left);
    const rightBox = bboxOf(right);
    const leftColumn = Math.floor(leftBox.x0 / columnWidth);
    const rightColumn = Math.floor(rightBox.x0 / columnWidth);

    if (leftColumn !== rightColumn) {
      return leftColumn - rightColumn;
    }

    return leftBox.y0 - rightBox.y0;
  });
}

function linesFromRegion(region) {
  if (Array.isArray(region?.lines)) {
    return region.lines;
  }

  if (Array.isArray(region?.paragraphs)) {
    return region.paragraphs.flatMap((paragraph) => paragraph.lines || []);
  }

  return [];
}

function wordsFromLine(line) {
  if (Array.isArray(line?.words)) {
    return line.words;
  }

  return String(line?.text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, confidence: line?.confidence ?? 100 }));
}

function regionsFrom(data) {
  if (Array.isArray(data?.blocks) && data.blocks.length) {
    return data.blocks;
  }

  if (Array.isArray(data?.paragraphs) && data.paragraphs.length) {
    return [{ paragraphs: data.paragraphs, bbox: bboxOf(data) }];
  }

  if (Array.isArray(data?.lines) && data.lines.length) {
    return [{ lines: data.lines, bbox: bboxOf(data) }];
  }

  return [];
}

export function cleanOcrResult(data, options = {}) {
  const { minConfidence = 62, minLineConfidence = 45 } = options;
  const regions = regionsFrom(data);
  const stats = { keptWords: 0, droppedWords: 0, confidenceSum: 0 };
  const lines = [];

  if (!regions.length) {
    // Photographs can return guesses without layout data; enforce confidence here too.
    if (Number(data?.confidence || 0) < minConfidence) {
      return { text: "", lines: [], meanConfidence: 0, ...stats };
    }
    const fallback = String(data?.text || "")
      .split(/\r?\n/)
      .map((line) => collapseRepeats(line.replace(DECORATIVE, " ").split(/\s+/).filter(token => !isJunkToken(token) && !token.includes("\uFFFD")).join(" ")))
      .filter((line) => line.length > 1);

    return {
      text: fallback.join("\n"),
      lines: fallback,
      meanConfidence: Number(data?.confidence || 0),
      ...stats,
    };
  }

  orderRegions(regions, { pageWidth: bboxOf(data).x1 }).forEach((region) => {
    linesFromRegion(region).forEach((line) => {
      const words = wordsFromLine(line);
      const lineConfidence = Number(line?.confidence ?? 100);

      if (lineConfidence < minLineConfidence) {
        stats.droppedWords += words.length;
        return;
      }

      const kept = [];

      words.forEach((word) => {
        const confidence = Number(word?.confidence ?? 100);
        const text = String(word?.text || "").replace(DECORATIVE, "").trim();

        if (!text || text.includes("\uFFFD") || confidence < minConfidence || isJunkToken(text)) {
          stats.droppedWords += 1;
          return;
        }

        stats.keptWords += 1;
        stats.confidenceSum += confidence;
        kept.push(text);
      });

      const text = collapseRepeats(kept.join(" ")).trim();

      if (text.length > 1) {
        lines.push(text);
      }
    });
  });

  const deduped = [];

  lines.forEach((line) => {
    const previous = deduped[deduped.length - 1];

    if (!previous || previous.toLowerCase() !== line.toLowerCase()) {
      deduped.push(line);
    }
  });

  return {
    text: deduped.join("\n"),
    lines: deduped,
    meanConfidence: stats.keptWords
      ? Number((stats.confidenceSum / stats.keptWords).toFixed(1))
      : 0,
    keptWords: stats.keptWords,
    droppedWords: stats.droppedWords,
  };
}
